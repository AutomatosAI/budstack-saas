import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRD-219 AC-4 — regression guard for the wrong-relation-name class.
 *
 * The schema names relations in snake_case (`order_items`, `webhook_deliveries`,
 * `users`) while the API layer exposes transformed names (`items`, `user`,
 * `deliveries`). Because `prisma` is exported as `any` (lib/db.ts), a handler
 * that copies the *response* names into a Prisma `include`/`select` compiles
 * fine and throws PrismaClientValidationError at runtime (the class of bug
 * fixed by PR #187 and PRD-219).
 *
 * Two layers of guard, both offline (no DB, no generated client):
 *  1. The schema still declares the relation names the fixed call-sites use
 *     (and does NOT grow look-alike fields matching the public names).
 *  2. The fixed call-sites still query the real relation names.
 *
 * The durable fix — a typed Prisma client — belongs to PRD-208.
 */

const root = process.cwd(); // vitest runs from nextjs_space/

function modelFields(modelName: string): string[] {
  const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
  const match = schema.match(
    new RegExp(`^model\\s+${modelName}\\s+\\{([\\s\\S]*?)^\\}`, "m"),
  );
  if (!match) throw new Error(`model ${modelName} not found in schema.prisma`);
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@@") && !line.startsWith("//"))
    .map((line) => line.split(/\s+/)[0]);
}

describe("schema relation names (PRD-219)", () => {
  it.each([
    { model: "orders", has: "order_items", not: "items" },
    { model: "orders", has: "users", not: "user" },
    { model: "webhooks", has: "webhook_deliveries", not: "deliveries" },
  ])("model $model has relation `$has` and no `$not` field", ({ model, has, not }) => {
    const fields = modelFields(model);
    expect(fields).toContain(has);
    expect(fields).not.toContain(not);
  });
});

describe("call-sites query real relation names (PRD-219)", () => {
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  it("tenant-admin webhooks GET counts `webhook_deliveries`", () => {
    const src = read("app/api/tenant-admin/webhooks/route.ts");
    expect(src).toContain("webhook_deliveries: true");
    expect(src).not.toMatch(/select:\s*\{\s*deliveries\s*:/);
  });

  it("drgreen-orders includes `order_items`, never `items`", () => {
    const src = read("lib/drgreen/drgreen-orders.ts");
    expect(src.match(/order_items/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(src).not.toMatch(/include:\s*\{\s*items\s*:/);
  });

  it("tenant-admin orders PATCH keeps the PR #187 fix", () => {
    const src = read("app/api/tenant-admin/orders/route.ts");
    expect(src).toContain("order_items: true");
    expect(src).not.toMatch(/include:\s*\{\s*items\s*:/);
  });
});
