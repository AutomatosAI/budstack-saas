import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { apiError } from "@/lib/api-error";
import { getTenantFeatures } from "@/lib/entitlements/features";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import {
  WIRE_SIGNATURE_HEADER,
  WIRE_TENANT_HEADER,
  verifyWireSignature,
  wireDraftRejection,
} from "@/lib/integrations/automatos-wire";

/**
 * Assisted-Wire inbound endpoint (US-011): an Automatos agent mission
 * delivers a DRAFT post into the tenant's Wire. Machine-to-machine — the
 * caller is the Automatos orchestrator, authenticated by a per-tenant HMAC
 * over the raw body (tenants.automatosWireSecret, encrypted at rest).
 *
 * Drafts ONLY: `published` is not part of the schema and is force-set false —
 * a payload claiming published still lands as a draft. The merchant reviews
 * and publishes in The Wire.
 */

const MAX_BODY_BYTES = 512 * 1024;

const wireDraftSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(100_000),
  excerpt: z.string().max(5000).optional(),
  seo_title: z.string().max(300).optional(),
  seo_description: z.string().max(1000).optional(),
});

// Same policy as the storefront article render
// (app/store/[slug]/the-wire/[postSlug]/page.tsx) — sanitized at ingest AND
// at render; keep the two in sync when either changes.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe", "video"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["class", "id"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
    video: ["src", "width", "height", "controls", "autoplay", "loop", "muted"],
  },
  allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
};

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get(WIRE_TENANT_HEADER);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`wire:${tenantId}`);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // Tenant + secret lookup runs outside tenant context (this is the
    // authentication step); everything after binds the tenant.
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        wireMode: true,
        automatosWireSecret: true,
        deletedAt: true,
        isActive: true,
      },
    });

    // Uniform 401 for unknown tenant / missing secret / bad signature —
    // no oracle for which part failed.
    if (!tenant || tenant.deletedAt || !tenant.automatosWireSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let secret: string;
    try {
      secret = decrypt(tenant.automatosWireSecret);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyWireSignature(rawBody, req.headers.get(WIRE_SIGNATURE_HEADER), secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rejection = wireDraftRejection(
      tenant.wireMode,
      getTenantFeatures({ id: tenant.id, plan: tenant.plan }),
    );
    if (rejection) {
      return NextResponse.json(
        {
          error:
            rejection === "NOT_ENTITLED"
              ? "Assisted Wire is not included in this tenant's plan."
              : "The Wire is in manual mode for this tenant.",
        },
        { status: 403 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const validation = wireDraftSchema.safeParse(parsed);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid draft payload", issues: validation.error.issues.length },
        { status: 422 },
      );
    }
    const draft = validation.data;

    const cleanContent = sanitizeHtml(draft.content, SANITIZE_OPTIONS);

    const post = await runWithTenantContextAsync(tenant.id, async () => {
      // Author = the tenant's owner admin (posts.authorId FKs users.id and the
      // draft has no human author). Tenants always have an admin row.
      const owner = await prisma.users.findFirst({
        where: { tenantId: tenant.id, role: "TENANT_ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!owner) {
        throw new Error(`No TENANT_ADMIN user for tenant ${tenant.id}`);
      }

      // Slug uniqueness: findFirst, not findUnique w/ the compound key — the
      // tenant-scope extension rewrites findUnique→findFirst and rejects the
      // compound key (same trap as the tenant-admin posts route).
      const base = slugify(draft.title) || "automatos-draft";
      let uniqueSlug = base;
      let counter = 1;
      while (await prisma.posts.findFirst({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${base}-${counter}`;
        counter++;
      }

      return prisma.posts.create({
        data: {
          id: crypto.randomUUID(),
          title: draft.title,
          slug: uniqueSlug,
          content: cleanContent,
          excerpt: draft.excerpt ?? null,
          published: false, // ALWAYS a draft — server-enforced
          source: "AUTOMATOS",
          seo:
            draft.seo_title || draft.seo_description
              ? {
                  title: draft.seo_title ?? null,
                  description: draft.seo_description ?? null,
                }
              : undefined,
          tenantId: tenant.id,
          authorId: owner.id,
          updatedAt: new Date(),
        },
      });
    });

    return NextResponse.json(
      { id: post.id, slug: post.slug, published: false },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error ingesting Automatos wire draft:", error);
    return apiError(error, {
      route: "POST /api/integrations/automatos/posts",
      safeMessage: "Failed to ingest draft",
    });
  }
}
