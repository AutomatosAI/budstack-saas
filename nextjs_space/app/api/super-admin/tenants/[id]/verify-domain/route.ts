import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { promises as dns } from "dns";
import { isApexDomain } from "@/lib/domain-utils";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

type VerificationStatus = "verified" | "pending" | "misconfigured";

interface VerificationResult {
  status: VerificationStatus;
  checkedAt: string;
  expected: string;
  found: string | null;
}

export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  try {
    const id = parseUuid(params.id);

    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: {
        id: true,
        customDomain: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!tenant.customDomain) {
      return NextResponse.json(
        { error: "No custom domain configured for this tenant" },
        { status: 400 },
      );
    }

    const cnameTarget =
      process.env.RAILWAY_CNAME_TARGET || "budstack-saas-production.up.railway.app";
    const domain = tenant.customDomain;
    const apex = isApexDomain(domain);

    let verification: VerificationResult;

    try {
      if (apex) {
        // Root/apex domains use A/AAAA records (ALIAS/ANAME resolves to A)
        // We can't directly verify a CNAME on apex, so check if A records resolve
        const addresses = await dns.resolve4(domain);
        if (addresses.length > 0) {
          // A records exist — domain is pointing somewhere. We can't confirm it's
          // pointing to Railway specifically without knowing Railway's IPs, so mark
          // as verified if any A records resolve (Railway handles SSL handshake).
          verification = {
            status: "verified",
            checkedAt: new Date().toISOString(),
            expected: `A record (ALIAS/ANAME to ${cnameTarget})`,
            found: addresses.join(", "),
          };
        } else {
          verification = {
            status: "pending",
            checkedAt: new Date().toISOString(),
            expected: `A record (ALIAS/ANAME to ${cnameTarget})`,
            found: null,
          };
        }
      } else {
        // Subdomain — check CNAME
        const cnames = await dns.resolveCname(domain);
        const matchesCname = cnames.some(
          (c) =>
            c === cnameTarget ||
            c.endsWith(".railway.app") ||
            c.endsWith(".budstacks.io"),
        );

        if (matchesCname) {
          verification = {
            status: "verified",
            checkedAt: new Date().toISOString(),
            expected: cnameTarget,
            found: cnames.join(", "),
          };
        } else {
          verification = {
            status: "misconfigured",
            checkedAt: new Date().toISOString(),
            expected: cnameTarget,
            found: cnames.join(", "),
          };
        }
      }
    } catch (dnsError: unknown) {
      const code = (dnsError as NodeJS.ErrnoException).code;
      // ENOTFOUND / ENODATA = no DNS records found yet
      if (code === "ENOTFOUND" || code === "ENODATA") {
        verification = {
          status: "pending",
          checkedAt: new Date().toISOString(),
          expected: apex
            ? `A record (ALIAS/ANAME to ${cnameTarget})`
            : cnameTarget,
          found: null,
        };
      } else {
        // Unexpected DNS error — still return a result
        verification = {
          status: "pending",
          checkedAt: new Date().toISOString(),
          expected: apex
            ? `A record (ALIAS/ANAME to ${cnameTarget})`
            : cnameTarget,
          found: `DNS error: ${code || "unknown"}`,
        };
      }
    }

    // Persist verification result in tenant settings
    const existingSettings =
      (tenant.settings as Record<string, unknown>) || {};
    await prisma.tenants.update({
      where: { id },
      data: {
        settings: {
          ...existingSettings,
          domainVerification: verification,
        },
      },
    });

    return NextResponse.json({
      domain,
      isApex: apex,
      cnameTarget,
      ...verification,
    });
  } catch (error) {
    return apiError(error, { route: "GET /api/super-admin/tenants/[id]/verify-domain" });
  }
});
