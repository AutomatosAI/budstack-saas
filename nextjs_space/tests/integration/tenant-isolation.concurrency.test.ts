import { describe, it, expect, beforeAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import {
  dockerAvailable,
  getPostgres,
  TENANT_A,
  TENANT_B,
} from "../helpers/withPostgres";

// PRD-207 AC-8 / PRD-202 proof — concurrency isolation against a live Postgres.
// The pre-PRD-202 bug bound the tenant via AsyncLocalStorage.enterWith(), which a
// concurrent request could observe and clobber, so interleaved requests under
// different tenants could read each other's rows. runWithTenantContextAsync uses
// `.run()` (a per-chain store), so this fans out many interleaved A/B queries with
// randomised awaits and asserts every query only ever saw its OWN tenant's rows.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => Math.floor(Math.random() * 12);

describe.skipIf(!dockerAvailable)(
  "AC-8 tenant context — no bleed under concurrency (real Postgres)",
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ prisma } = await getPostgres());
    });

    it("interleaved A/B reads each see only their own tenant's users", async () => {
      const tasks = Array.from({ length: 40 }, (_, i) => {
        const tenant = i % 2 === 0 ? TENANT_A : TENANT_B;
        return runWithTenantContextAsync(tenant, async () => {
          await sleep(jitter());
          const first = await prisma.users.findMany({ select: { tenantId: true } });
          await sleep(jitter());
          // A second read after another await: the context must survive the gap.
          const second = await prisma.users.findMany({ select: { tenantId: true } });
          return { tenant, first, second };
        });
      });

      const results = await Promise.all(tasks);

      for (const { tenant, first, second } of results) {
        // Fixture seeds exactly two users per tenant.
        expect(first).toHaveLength(2);
        expect(second).toHaveLength(2);
        expect(first.every((u) => u.tenantId === tenant)).toBe(true);
        expect(second.every((u) => u.tenantId === tenant)).toBe(true);
      }
    });

    it("interleaved null-access reads never expose the other tenant's private rows", async () => {
      const tasks = Array.from({ length: 24 }, (_, i) => {
        const tenant = i % 2 === 0 ? TENANT_A : TENANT_B;
        const foreign = tenant === TENANT_A ? TENANT_B : TENANT_A;
        return runWithTenantContextAsync(tenant, async () => {
          await sleep(jitter());
          const templates = await prisma.email_templates.findMany({
            select: { tenantId: true, isSystem: true },
          });
          return { foreign, templates };
        });
      });

      const results = await Promise.all(tasks);

      for (const { foreign, templates } of results) {
        // email_templates is a null-access scoped model: own-tenant rows + global
        // (tenantId null) system rows are allowed; the other tenant's never are.
        expect(templates.some((t) => t.tenantId === foreign)).toBe(false);
        expect(
          templates.every((t) => t.tenantId !== foreign),
        ).toBe(true);
      }
    });
  },
);
