import { describe, it, expect, beforeAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import {
  dockerAvailable,
  getPostgres,
  TENANT_A,
  TEMPLATE_A_ID,
  TEMPLATE_B_ID,
  SYSTEM_TEMPLATE_ID,
} from "../helpers/withPostgres";

// PRD-207 — real-DB regression for PR-A finding #1 (the HIGH cross-tenant clone
// leak). The clone route's source lookup is
//   email_templates.findFirst({ where: { id, OR: [{ isSystem: true }, { tenantId }] } })
// run inside the caller's bound tenant. This replicates that exact query against a
// live Postgres + the lib/db middleware and proves: a tenant cannot resolve another
// tenant's PRIVATE template by id (the leak), while system + own templates resolve.

const sourceLookup = (prisma: PrismaClient, id: string, tenantId: string) =>
  runWithTenantContextAsync(tenantId, () =>
    prisma.email_templates.findFirst({
      where: { id, OR: [{ isSystem: true }, { tenantId }] },
    }),
  );

describe.skipIf(!dockerAvailable)(
  "clone source lookup — cross-tenant leak closed (real Postgres)",
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ prisma } = await getPostgres());
    });

    it("tenant A cannot resolve tenant B's private template by id (404)", async () => {
      const found = await sourceLookup(prisma, TEMPLATE_B_ID, TENANT_A);
      expect(found).toBeNull();
    });

    it("tenant A can resolve a global system template (legit clone source)", async () => {
      const found = await sourceLookup(prisma, SYSTEM_TEMPLATE_ID, TENANT_A);
      expect(found?.id).toBe(SYSTEM_TEMPLATE_ID);
      expect(found?.isSystem).toBe(true);
    });

    it("tenant A can resolve its own private template", async () => {
      const found = await sourceLookup(prisma, TEMPLATE_A_ID, TENANT_A);
      expect(found?.id).toBe(TEMPLATE_A_ID);
      expect(found?.tenantId).toBe(TENANT_A);
    });
  },
);
