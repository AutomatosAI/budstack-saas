import { describe, it, expect, vi, beforeEach } from "vitest";

// SEO Supercharge US-010 — the per-key write that replaced the read-modify-write
// on `tenants.pageSeo`.
//
// The merge PLAN is pure, so its rules are asserted with no database at all. The
// statement that applies it is asserted at the driver boundary: what is bound as
// a PARAMETER (never interpolated), and what the caller gets back.
const prismaMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  planPageSeoWrite,
  writeStorePageSeo,
} from "@/lib/seo/page-seo-write";

const TENANT_A = "tenant-a";

/** The `Prisma.Sql` the route handed the driver, decomposed. */
function lastStatement() {
  const [sql] = prismaMock.$queryRaw.mock.calls.at(-1) ?? [];
  return {
    text: (sql?.strings ?? []).join(" "),
    values: sql?.values ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw.mockResolvedValue([{ pageSeo: { about: { title: "A" } } }]);
});

describe("planPageSeoWrite — the merge rules, with no database", () => {
  it("always removes the key it is about to write, so save and clear are one statement", () => {
    expect(planPageSeoWrite("about", { title: "About us" })).toEqual({
      removeKeys: ["about"],
      patch: { about: { title: "About us" } },
    });
  });

  it("also retires the legacy key the page replaced", () => {
    // /faq redirects to /support, so saving Support must retire the old `faq`
    // entry — otherwise readStorePageSeo would fall back to it the moment the
    // owner cleared the new one.
    const plan = planPageSeoWrite("support", { title: "Support" });

    expect(plan.removeKeys).toEqual(["support", "faq"]);
  });

  it("carries no legacy key for a page that never replaced one", () => {
    expect(planPageSeoWrite("home", { title: "Home" }).removeKeys).toEqual(["home"]);
  });

  it("empties the patch when the owner cleared every field — a delete, not a null entry", () => {
    for (const cleared of [undefined, {}, { title: "", description: "   " }]) {
      expect(planPageSeoWrite("contact", cleared)).toEqual({
        removeKeys: ["contact"],
        patch: {},
      });
    }
  });

  it("trims, and stores only the fields that carry text", () => {
    expect(
      planPageSeoWrite("about", {
        title: "  About us  ",
        description: "",
        ogImage: " logo.png ",
      }).patch,
    ).toEqual({ about: { title: "About us", ogImage: "logo.png" } });
  });

  it("fails closed on a malformed body rather than storing junk", () => {
    for (const junk of ["a string", 42, ["an", "array"], null]) {
      expect(planPageSeoWrite("about", junk).patch).toEqual({});
    }
  });
});

describe("writeStorePageSeo — the statement", () => {
  it("binds the tenant id and the patch as parameters, never as SQL text", async () => {
    await writeStorePageSeo(TENANT_A, "about", { title: "About us" });

    const { text, values } = lastStatement();

    expect(values).toContain(TENANT_A);
    expect(values).toContain(JSON.stringify({ about: { title: "About us" } }));
    expect(text).not.toContain(TENANT_A);
  });

  it("binds every retired key as its own parameter", async () => {
    await writeStorePageSeo(TENANT_A, "support", { title: "Support" });

    expect(lastStatement().values).toEqual(
      expect.arrayContaining(["support", "faq"]),
    );
  });

  it("constrains the update to a live row — soft-delete is not injected into updates", async () => {
    await writeStorePageSeo(TENANT_A, "about", { title: "About us" });

    expect(lastStatement().text).toMatch(/"deletedAt"\s+IS\s+NULL/);
  });

  it("treats a non-object blob as no data instead of aborting the statement", async () => {
    await writeStorePageSeo(TENANT_A, "about", { title: "About us" });

    expect(lastStatement().text).toContain("jsonb_typeof");
  });

  it("returns the new blob the database computed", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { pageSeo: { about: { title: "A" }, home: { title: "H" } } },
    ]);

    expect(await writeStorePageSeo(TENANT_A, "about", { title: "A" })).toEqual({
      about: { title: "A" },
      home: { title: "H" },
    });
  });

  it("returns {} when clearing the last page emptied the column", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ pageSeo: null }]);

    expect(await writeStorePageSeo(TENANT_A, "about", {})).toEqual({});
  });

  it("returns null when no live tenant row matched, so the caller can 404", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    expect(await writeStorePageSeo(TENANT_A, "about", { title: "A" })).toBeNull();
  });

  it("issues exactly one statement — no read-modify-write round trip", async () => {
    await writeStorePageSeo(TENANT_A, "about", { title: "About us" });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
