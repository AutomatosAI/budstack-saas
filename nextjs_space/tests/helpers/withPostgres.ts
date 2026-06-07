import { execFileSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { bypassTenantScope } from "@/lib/tenant/tenant-scope-policy";

// PRD-207 AC-1 — real-Postgres integration harness. Spins ONE throwaway Postgres
// container (shared across the integration project's files via singleFork), applies
// the schema with `prisma db push`, and seeds a deterministic two-tenant fixture so
// the lib/db `$use` tenant-scope middleware can be proven against a live engine
// rather than a mock. `db push` (NOT `migrate deploy`) is deliberate: the PRD-208
// `CREATE INDEX CONCURRENTLY` migration cannot run inside a migration transaction,
// and a fresh test DB needs the schema shape, not the migration history.

/**
 * Whether the integration suite should run. Auto-detects a reachable Docker
 * daemon so `pnpm test` is green on machines without Docker (the tests skip)
 * and exercises a real DB where Docker is up. `RUN_INTEGRATION=0` force-skips
 * (the CI unit job); `RUN_INTEGRATION=1` force-runs (fail loud if Docker absent).
 */
export const dockerAvailable: boolean = (() => {
  if (process.env.RUN_INTEGRATION === "0") return false;
  if (process.env.RUN_INTEGRATION === "1") return true;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// ── Deterministic fixture identifiers (exported for the test files) ────────────
export const TENANT_A = "itest-tenant-a";
export const TENANT_B = "itest-tenant-b";

export const ADMIN_A_EMAIL = "admin-a@itest.dev";
export const CUSTOMER_A_EMAIL = "cust-a@itest.dev";
export const ADMIN_B_EMAIL = "admin-b@itest.dev";
export const CUSTOMER_B_EMAIL = "cust-b@itest.dev";

export const CUSTOMER_A_ID = "itest-user-cust-a";
export const CUSTOMER_B_ID = "itest-user-cust-b";

export const SYSTEM_TEMPLATE_ID = "itest-template-system";
export const TEMPLATE_A_ID = "itest-template-a";
export const TEMPLATE_B_ID = "itest-template-b";

export type Harness = {
  prisma: PrismaClient;
  container: StartedPostgreSqlContainer;
};

let started: Promise<Harness> | null = null;

/**
 * Start (or reuse) the shared Postgres container, push the schema, seed the
 * fixture, and return the REAL prisma client. Memoised: the first caller starts
 * the container; every later caller awaits the same promise.
 */
export function getPostgres(): Promise<Harness> {
  if (!started) started = start();
  return started;
}

async function start(): Promise<Harness> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();

  // lib/db reads DATABASE_URL at import time and returns a mock client unless it
  // points at a real DB — so set it BEFORE the dynamic import below.
  process.env.DATABASE_URL = url;

  execFileSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" },
  );

  // Dynamic import AFTER DATABASE_URL is set → a real PrismaClient, not the mock.
  const { prisma } = (await import("@/lib/db")) as { prisma: PrismaClient };

  await seed(prisma);

  return { prisma, container };
}

async function seed(prisma: PrismaClient): Promise<void> {
  // tenants is NOT a tenant-scoped model → create directly, no bound context.
  await prisma.tenants.createMany({
    data: [
      {
        id: TENANT_A,
        businessName: "Itest Tenant A",
        subdomain: "itest-tenant-a",
        isActive: true,
        updatedAt: new Date(),
      },
      {
        id: TENANT_B,
        businessName: "Itest Tenant B",
        subdomain: "itest-tenant-b",
        isActive: true,
        updatedAt: new Date(),
      },
    ],
  });

  // users + email_templates ARE tenant-scoped: the $use middleware refuses an
  // implicit unbound write, so each tenant's rows are created INSIDE that
  // tenant's bound context (which also injects the tenantId).
  await runWithTenantContextAsync(TENANT_A, async () => {
    await prisma.users.createMany({
      data: [
        {
          id: "itest-user-admin-a",
          email: ADMIN_A_EMAIL,
          password: "x",
          name: "Admin A",
          role: "TENANT_ADMIN",
          tenantId: TENANT_A,
          updatedAt: new Date(),
        },
        {
          id: CUSTOMER_A_ID,
          email: CUSTOMER_A_EMAIL,
          password: "x",
          name: "Customer A",
          role: "PATIENT",
          tenantId: TENANT_A,
          updatedAt: new Date(),
        },
      ],
    });
    await prisma.email_templates.create({
      data: {
        id: TEMPLATE_A_ID,
        name: "Tenant A Private",
        subject: "A subject",
        contentHtml: "<p>A</p>",
        isSystem: false,
        tenantId: TENANT_A,
      },
    });
  });

  await runWithTenantContextAsync(TENANT_B, async () => {
    await prisma.users.createMany({
      data: [
        {
          id: "itest-user-admin-b",
          email: ADMIN_B_EMAIL,
          password: "x",
          name: "Admin B",
          role: "TENANT_ADMIN",
          tenantId: TENANT_B,
          updatedAt: new Date(),
        },
        {
          id: CUSTOMER_B_ID,
          email: CUSTOMER_B_EMAIL,
          password: "x",
          name: "Customer B",
          role: "PATIENT",
          tenantId: TENANT_B,
          updatedAt: new Date(),
        },
      ],
    });
    await prisma.email_templates.create({
      data: {
        id: TEMPLATE_B_ID,
        name: "Tenant B Private",
        subject: "B subject",
        contentHtml: "<p>B</p>",
        isSystem: false,
        tenantId: TENANT_B,
      },
    });
  });

  // A global system template (tenantId null, isSystem true) — cloneable by any
  // tenant. Created under an explicit-null context so the middleware treats it as
  // a deliberate system write rather than the implicit-unbound leak vector.
  await bypassTenantScope(() =>
    prisma.email_templates.create({
      data: {
        id: SYSTEM_TEMPLATE_ID,
        name: "System Welcome",
        subject: "Welcome",
        contentHtml: "<p>system</p>",
        isSystem: true,
        tenantId: null,
      },
    }),
  );
}
