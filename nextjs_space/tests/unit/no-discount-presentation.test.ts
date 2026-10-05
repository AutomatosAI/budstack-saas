import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BS-F04 / FR-4: nothing on a BudStacks storefront presents a price as a
 * discount — no was/now strike-through, badge or percentage-off. A Dr Green
 * Commission Flex price is the holder's price, not a reduction (Dr Green
 * commission-flex PRD §5 non-goals). Source scan of every storefront surface.
 */
const root = process.cwd(); // vitest runs from nextjs_space/
const STOREFRONT_DIRS = ["app/store", "components/sections", "components/shop", "components/storefront"];
const STOREFRONT_FILES = ["components/cart-dropdown.tsx"];

function sourceFiles(dir: string): string[] {
  const abs = join(root, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(abs, name);
    if (statSync(full).isDirectory()) return sourceFiles(relative(root, full));
    return /\.(tsx|ts|css)$/.test(name) ? [relative(root, full)] : [];
  });
}

const files = [...STOREFRONT_DIRS.flatMap(sourceFiles), ...STOREFRONT_FILES];

describe("no discount presentation on the storefront (BS-F04)", () => {
  it("scans the storefront surfaces", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain("app/store/[slug]/products/[id]/product-detail-client.tsx");
  });

  it.each([
    ["a percentage-off badge", /%\s*OFF/i],
    ["strike-through styling", /line-through|textDecoration:\s*["']line-through|<del[\s>]|<s>|<strike/],
    ["a render of product.discount", /\.discount\b/],
  ])("has no %s", (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(readFileSync(join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
