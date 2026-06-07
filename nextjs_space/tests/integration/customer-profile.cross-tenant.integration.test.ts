import { describe, it, expect, beforeAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import {
  dockerAvailable,
  getPostgres,
  TENANT_A,
  TENANT_B,
  CUSTOMER_A_ID,
  CUSTOMER_A_EMAIL,
} from "../helpers/withPostgres";

// PRD-207 US-011 — the real-DB complement to tests/unit/customer-profile.test.ts.
// The unit test proves the profile handler runs its `users.findFirst({where:{email}})`
// INSIDE the bound host-tenant context. This proves the other half against a LIVE
// Postgres + the genuine lib/db `$use` middleware: under tenant B's context, a
// tenant-A customer's row is unreadable and unmodifiable (the host-blind
// cross-tenant leak, PRD-203 AC-3, stays closed at the engine layer).

describe.skipIf(!dockerAvailable)(
  "US-011 customer profile — cross-tenant isolation (real Postgres)",
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ prisma } = await getPostgres());
    });

    it("a tenant-A customer is invisible when the context is tenant B", async () => {
      const underB = await runWithTenantContextAsync(TENANT_B, () =>
        prisma.users.findFirst({ where: { email: CUSTOMER_A_EMAIL } }),
      );
      expect(underB).toBeNull();
    });

    it("the same customer is visible under tenant A and scoped to tenant A", async () => {
      const underA = await runWithTenantContextAsync(TENANT_A, () =>
        prisma.users.findFirst({ where: { email: CUSTOMER_A_EMAIL } }),
      );
      expect(underA?.id).toBe(CUSTOMER_A_ID);
      expect(underA?.tenantId).toBe(TENANT_A);
    });

    it("a PATCH-style update from tenant B cannot modify the tenant-A row", async () => {
      const { count } = await runWithTenantContextAsync(TENANT_B, () =>
        prisma.users.updateMany({
          where: { email: CUSTOMER_A_EMAIL },
          data: { firstName: "Hijacked" },
        }),
      );
      expect(count).toBe(0);

      // And the row really is untouched when read back under its own tenant.
      const afterA = await runWithTenantContextAsync(TENANT_A, () =>
        prisma.users.findFirst({ where: { id: CUSTOMER_A_ID } }),
      );
      expect(afterA?.firstName).not.toBe("Hijacked");
    });

    it("a targeted update by id from tenant B is scoped out (no foreign row found)", async () => {
      await expect(
        runWithTenantContextAsync(TENANT_B, () =>
          prisma.users.update({
            where: { id: CUSTOMER_A_ID },
            data: { firstName: "Hijacked" },
          }),
        ),
      ).rejects.toThrow();
    });
  },
);
