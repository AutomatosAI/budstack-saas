import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// LLM Visibility US-005 — the AI citation monitor.
//
// Five properties carry it, and each is a different way of being wrong:
//
//   1. THE MATCH IS A HOST MATCH. A model that names the store without linking
//      it has not cited it, and a URL on somebody else's host is not evidence.
//      www., subpaths, ports, trailing punctuation and the bare-host form all
//      have to land on the same answer.
//   2. NO KEY IS NOT AN ERROR. A store without an Automatos connection reaches
//      no provider, spends nothing, and comes back with the same "not
//      connected" state the drafting path uses.
//   3. THE CAP IS A BILL. Every check is a paid completion on the store's own
//      account, so a bigger catalogue must never become a bigger invoice.
//   4. ONE STORE'S FAILURE DOES NOT STOP THE REST, and a store that threw must
//      not look like a store nobody cites.
//   5. THE SCHEDULE IS IDEMPOTENT. A fixed scheduler id upserted on a queue of
//      its own is what stops N booted workers producing N sweeps a week.
//
// Module-boundary mocks only (prisma, the rate limiter, the logger). The real
// engine resolution, the real metering, the real matcher, the real prompt
// builder and the real sweep all execute; only the network is stubbed, through
// the same `provider` seam `generateSeoDraft` already exposes.

const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn(), findMany: vi.fn() },
  conditions: { findMany: vi.fn() },
  products: { findMany: vi.fn() },
  llm_citation_checks: { createMany: vi.fn(), findMany: vi.fn() },
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import type { AiAssistProvider } from "@/lib/seo/ai-assist";
import {
  citationHosts,
  findCitation,
  normaliseCitationHost,
} from "@/lib/seo/citation-match";
import {
  probeCitation,
  resolveCitationEngines,
  type DiscoverModels,
} from "@/lib/seo/citation-engine";
import {
  buildCitationPrompts,
  resolveCitationCountry,
  summariseCitationChecks,
  CITATION_DEFAULT_ENGINE,
  CITATION_MAX_CHECKS_PER_RUN,
  CITATION_MAX_ENGINES_PER_RUN,
  CITATION_MAX_PROMPTS_PER_RUN,
  CITATION_MENTION_MAX_CHARS,
  CITATION_MONITOR_COPY,
  LLM_CITATION_CRON,
  LLM_CITATION_JOB,
  LLM_CITATION_SCHEDULER_ID,
  type CitationCheckRow,
} from "@/lib/seo/citation-monitor";
import {
  runCitationSweep,
  runTenantCitationChecks,
} from "@/lib/seo/citation-monitor-runner";
import { findCitationTenants } from "@/lib/seo/citation-monitor-store";
import {
  parseCitationCheck,
  parseCitationsBody,
} from "@/components/admin/seo/citations-client";

const TENANT_A = "tenant-a";
const STORE = {
  tenantId: TENANT_A,
  subdomain: "greenleaf",
  customDomain: null as string | null,
  businessName: "Green Leaf",
  country: "Portugal",
};

/** A provider that answers every prompt with the same text, and counts calls. */
function stubProvider(text: string): AiAssistProvider & {
  calls: { prompt: string; modelId: string | null | undefined }[];
} {
  const calls: { prompt: string; modelId: string | null | undefined }[] = [];
  return {
    id: "stub",
    label: "Stub",
    calls,
    async complete(request) {
      calls.push({ prompt: request.prompt, modelId: request.modelId });
      return { ok: true, text };
    },
  };
}

const noModels: DiscoverModels = async () => ({ ok: true, models: [] });

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.tenants.findFirst.mockResolvedValue({
    automatosApiKey: "ak_sec_stored",
    automatosAgentId: 7,
  });
  prismaMock.conditions.findMany.mockResolvedValue([]);
  prismaMock.products.findMany.mockResolvedValue([]);
  prismaMock.llm_citation_checks.createMany.mockImplementation(
    async ({ data }: { data: unknown[] }) => ({ count: data.length }),
  );
});

// ── 1. The match ────────────────────────────────────────────────────────────

describe("host matching", () => {
  const hosts = ["greenleaf.budstacks.io", "greenleaf.example"];

  it.each([
    ["https://greenleaf.budstacks.io/products/blue-dream", true],
    ["http://www.greenleaf.budstacks.io", true],
    ["greenleaf.budstacks.io/conditions/chronic-pain", true],
    ["www.greenleaf.example", true],
    ["GreenLeaf.Example/Products", true],
    ["greenleaf.budstacks.io:443/products", true],
    ["https://greenleaf.budstacks.io.evil.test/phish", false],
    ["https://notgreenleaf.budstacks.io", false],
    ["https://budstacks.io/greenleaf", false],
    ["https://competitor.example/greenleaf.budstacks.io", false],
  ])("%s → cited=%s", (url, expected) => {
    const answer = `You could try ${url} for more information.`;
    expect(findCitation(answer, hosts).cited).toBe(expected);
  });

  it("keeps the URL as written, without the sentence's full stop", () => {
    const match = findCitation(
      "Have a look at https://greenleaf.example/products/blue-dream.",
      hosts,
    );
    expect(match.citedUrl).toBe("https://greenleaf.example/products/blue-dream");
  });

  it("returns the first match when an answer links the store twice", () => {
    const match = findCitation(
      "See greenleaf.example/a and later greenleaf.example/b",
      hosts,
    );
    expect(match.citedUrl).toBe("greenleaf.example/a");
  });

  it("carries a bounded window of the answer as evidence", () => {
    const answer = `${"context ".repeat(200)}visit greenleaf.example now ${"tail ".repeat(200)}`;
    const match = findCitation(answer, hosts);
    expect(match.cited).toBe(true);
    expect(match.mentionText).toContain("greenleaf.example");
    expect(match.mentionText!.length).toBeLessThanOrEqual(
      CITATION_MENTION_MAX_CHARS,
    );
  });

  it("has no evidence when there is no citation", () => {
    expect(findCitation("Ask your doctor.", hosts)).toEqual({
      cited: false,
      citedUrl: null,
      mentionText: null,
    });
  });

  it("cannot match when the store has no hosts", () => {
    expect(findCitation("greenleaf.example", []).cited).toBe(false);
  });

  it("normalises www, case, port and trailing dot to one key", () => {
    expect(normaliseCitationHost("WWW.Example.com:8443.")).toBe("example.com");
  });

  it("matches on the platform host and the custom domain alike", () => {
    const both = citationHosts({
      subdomain: "greenleaf",
      customDomain: "shop.greenleaf.example",
    });
    expect(both).toContain("shop.greenleaf.example");
    expect(both.some((host) => host.startsWith("greenleaf."))).toBe(true);
  });

  it("does not carry a lastIndex between two answers", () => {
    const first = findCitation("greenleaf.example/a", hosts);
    const second = findCitation("greenleaf.example/b", hosts);
    expect(first.cited && second.cited).toBe(true);
  });
});

// ── 2. Engines, and the adapter contract ────────────────────────────────────

describe("engine resolution", () => {
  it("varies across the workspace's models when it exposes them", async () => {
    const engines = await resolveCitationEngines(
      { apiKey: "ak_sec_stored" },
      async () => ({ ok: true, models: ["alpha-1", "beta-2", "gamma-3"] }),
    );
    expect(engines).toEqual([
      { engine: "alpha-1", modelId: "alpha-1" },
      { engine: "beta-2", modelId: "beta-2" },
    ]);
    expect(engines.length).toBeLessThanOrEqual(CITATION_MAX_ENGINES_PER_RUN);
  });

  it.each([
    ["an empty list", { ok: true as const, models: [] }],
    ["a failed lookup", { ok: false as const, reason: "upstream" as const }],
  ])("falls back to the workspace default on %s", async (_label, result) => {
    const engines = await resolveCitationEngines(
      { apiKey: "ak_sec_stored" },
      async () => result,
    );
    expect(engines).toEqual([
      { engine: CITATION_DEFAULT_ENGINE, modelId: null },
    ]);
  });

  it("labels rows with the workspace's own model ids, never a vendor name", async () => {
    const engines = await resolveCitationEngines(
      { apiKey: "ak_sec_stored" },
      async () => ({ ok: true, models: ["some-workspace-model"] }),
    );
    expect(engines[0].engine).toBe("some-workspace-model");
  });
});

describe("the probe", () => {
  it("sends the model id and reports what the answer did", async () => {
    const provider = stubProvider("Try greenleaf.example/products today.");
    const result = await probeCitation({
      tenantId: TENANT_A,
      engine: { engine: "alpha-1", modelId: "alpha-1" },
      prompt: "Where can a patient go?",
      hosts: ["greenleaf.example"],
      provider,
    });

    expect(provider.calls).toEqual([
      { prompt: "Where can a patient go?", modelId: "alpha-1" },
    ]);
    expect(result).toMatchObject({
      status: "ok",
      engine: "alpha-1",
      cited: true,
      citedUrl: "greenleaf.example/products",
    });
  });

  it("records a non-citation as a result rather than a failure", async () => {
    const provider = stubProvider("Speak to your prescriber.");
    const result = await probeCitation({
      tenantId: TENANT_A,
      engine: { engine: CITATION_DEFAULT_ENGINE, modelId: null },
      prompt: "q",
      hosts: ["greenleaf.example"],
      provider,
    });

    expect(result).toMatchObject({ status: "ok", cited: false, citedUrl: null });
  });

  it("never reaches the provider when the tenant has no key", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: null,
      automatosAgentId: null,
    });
    const provider = stubProvider("unused");

    const result = await probeCitation({
      tenantId: TENANT_A,
      engine: { engine: CITATION_DEFAULT_ENGINE, modelId: null },
      prompt: "q",
      hosts: ["greenleaf.example"],
      provider,
    });

    expect(provider.calls).toEqual([]);
    expect(result).toMatchObject({
      status: "skipped",
      outcome: { status: "unavailable", reason: "not_connected" },
    });
  });
});

// ── 3. Prompts, and the market they come from ───────────────────────────────

describe("prompt generation", () => {
  it("asks the market's questions, capped, in medical-information framing", () => {
    const prompts = buildCitationPrompts({
      country: "Portugal",
      conditions: ["chronic pain", "insomnia", "anxiety", "epilepsy"],
      categories: ["flower", "oil", "capsules"],
    });

    expect(prompts.length).toBe(CITATION_MAX_PROMPTS_PER_RUN);
    expect(prompts.every((prompt) => prompt.includes("Portugal"))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes("chronic pain"))).toBe(true);
    // No commercial framing: "buy" is the shape engine content policy refuses.
    expect(prompts.some((prompt) => /\bbuy\b/i.test(prompt))).toBe(false);
    expect(prompts.some((prompt) => /patient/i.test(prompt))).toBe(true);
  });

  it("is deterministic, so week-over-week rows compare", () => {
    const market = {
      country: "Germany",
      conditions: ["chronic pain"],
      categories: ["oil"],
    };
    expect(buildCitationPrompts(market)).toEqual(buildCitationPrompts(market));
  });

  it("still asks the access questions for a store with no catalogue", () => {
    const prompts = buildCitationPrompts({
      country: "Portugal",
      conditions: [],
      categories: [],
    });
    expect(prompts.length).toBe(2);
  });

  it("drops blanks and case-duplicate topics", () => {
    const prompts = buildCitationPrompts({
      country: "Portugal",
      conditions: ["Chronic Pain", "chronic pain", "  ", "insomnia"],
      categories: [],
    });
    expect(prompts.filter((p) => /chronic pain/i.test(p))).toHaveLength(1);
  });

  it("prefers the named country over the code, and never renders an empty one", () => {
    expect(
      resolveCitationCountry({ businessCountry: "Portugal", countryCode: "PT" }),
    ).toBe("Portugal");
    expect(
      resolveCitationCountry({ businessCountry: "  ", countryCode: "DE" }),
    ).toBe("DE");
    expect(resolveCitationCountry({})).toBe("Europe");
  });
});

// ── 4. The sweep: gating, caps, isolation ───────────────────────────────────

describe("the sweep", () => {
  it("spends nothing for a store whose key was cleared", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: "   ",
      automatosAgentId: null,
    });
    const provider = stubProvider("unused");

    const outcome = await runTenantCitationChecks(STORE, new Date(), {
      provider,
      discoverModels: noModels,
    });

    expect(provider.calls).toEqual([]);
    expect(prismaMock.llm_citation_checks.createMany).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      stopped: "not_connected",
      attempted: 0,
      recorded: 0,
    });
  });

  it("never exceeds the per-run cap, however big the catalogue", async () => {
    prismaMock.conditions.findMany.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ name: `condition ${i}` })),
    );
    prismaMock.products.findMany.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({ category: `category ${i}` })),
    );
    const provider = stubProvider("No stores mentioned.");

    const outcome = await runTenantCitationChecks(STORE, new Date(), {
      provider,
      discoverModels: async () => ({ ok: true, models: ["alpha", "beta"] }),
    });

    expect(provider.calls.length).toBe(CITATION_MAX_CHECKS_PER_RUN);
    expect(outcome.attempted).toBe(CITATION_MAX_CHECKS_PER_RUN);
    expect(outcome.recorded).toBe(CITATION_MAX_CHECKS_PER_RUN);
  });

  it("asks one model the whole market before moving to the next", async () => {
    const provider = stubProvider("nothing here");
    await runTenantCitationChecks(STORE, new Date(), {
      provider,
      discoverModels: async () => ({ ok: true, models: ["alpha", "beta"] }),
    });

    const asked = provider.calls.map((call) => call.modelId);
    expect(asked.indexOf("beta")).toBeGreaterThan(asked.lastIndexOf("alpha"));
  });

  it("writes one instant across every row of a run", async () => {
    const now = new Date("2026-08-17T04:00:00.000Z");
    await runTenantCitationChecks(STORE, now, {
      provider: stubProvider("greenleaf.budstacks.io is one option"),
      discoverModels: noModels,
    });

    const { data } = prismaMock.llm_citation_checks.createMany.mock.calls[0][0];
    expect(data.length).toBeGreaterThan(0);
    expect(
      data.every(
        (row: { checkedAt: Date; tenantId: string }) =>
          row.checkedAt === now && row.tenantId === TENANT_A,
      ),
    ).toBe(true);
  });

  it("stops a store's pass on a terminal refusal rather than paying twelve times", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, {
        status: 429,
        headers: { "retry-after": "60" },
      }),
    });
    const provider = stubProvider("unused");

    const outcome = await runTenantCitationChecks(STORE, new Date(), {
      provider,
      discoverModels: noModels,
    });

    expect(outcome.attempted).toBe(1);
    expect(outcome.stopped).toBe("rate_limited");
    expect(prismaMock.llm_citation_checks.createMany).not.toHaveBeenCalled();
  });

  it("sweeps only active, Pro, connected stores", async () => {
    prismaMock.tenants.findMany.mockResolvedValue([
      {
        id: "pro-store",
        subdomain: "pro",
        customDomain: null,
        businessName: "Pro",
        businessCountry: "Portugal",
        countryCode: "PT",
        plan: "pro",
      },
      {
        id: "basic-store",
        subdomain: "basic",
        customDomain: null,
        businessName: "Basic",
        businessCountry: null,
        countryCode: "PT",
        plan: "basic",
      },
      {
        id: "unknown-plan",
        subdomain: "unknown",
        customDomain: null,
        businessName: "Unknown",
        businessCountry: null,
        countryCode: "PT",
        plan: "enterprise-gold",
      },
    ]);

    const tenants = await findCitationTenants();

    expect(tenants.map((tenant) => tenant.tenantId)).toEqual(["pro-store"]);
    const where = prismaMock.tenants.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ isActive: true, automatosApiKey: { not: null } });
    // The credential answers a presence question in SQL and is never selected.
    expect(
      prismaMock.tenants.findMany.mock.calls[0][0].select.automatosApiKey,
    ).toBeUndefined();
  });

  it("keeps one store's failure off every other store", async () => {
    prismaMock.tenants.findMany.mockResolvedValue([
      {
        id: "broken",
        subdomain: "broken",
        customDomain: null,
        businessName: "Broken",
        businessCountry: "Portugal",
        countryCode: "PT",
        plan: "pro",
      },
      {
        id: "healthy",
        subdomain: "healthy",
        customDomain: null,
        businessName: "Healthy",
        businessCountry: "Portugal",
        countryCode: "PT",
        plan: "pro",
      },
    ]);
    prismaMock.tenants.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "broken") throw new Error("connection reset");
        return { automatosApiKey: "ak_sec_stored", automatosAgentId: null };
      },
    );

    const outcome = await runCitationSweep(new Date(), {
      provider: stubProvider("nothing"),
      discoverModels: noModels,
    });

    expect(outcome.tenants).toBe(2);
    expect(outcome.perTenant[0]).toMatchObject({
      tenantId: "broken",
      error: "connection reset",
      recorded: 0,
    });
    expect(outcome.perTenant[1].error).toBeNull();
    expect(outcome.perTenant[1].recorded).toBeGreaterThan(0);
  });

  it("scopes every read and write it makes to one tenant", async () => {
    await runTenantCitationChecks(STORE, new Date(), {
      provider: stubProvider("nothing"),
      discoverModels: noModels,
    });

    expect(prismaMock.conditions.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT_A,
    });
    expect(prismaMock.products.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT_A,
    });
  });
});

// ── 5. The schedule ─────────────────────────────────────────────────────────

describe("the weekly schedule", () => {
  const worker = readFileSync(
    join(process.cwd(), "scripts", "email-worker.ts"),
    "utf8",
  );

  it("is weekly, on a fixed id, so N workers make one sweep", () => {
    expect(LLM_CITATION_CRON).toBe("0 4 * * 1");
    expect(LLM_CITATION_SCHEDULER_ID).toBe("llm-citation-weekly");
    expect(worker).toContain("upsertJobScheduler");
    expect(worker).toContain("LLM_CITATION_SCHEDULER_ID");
    expect(worker).toContain("LLM_CITATION_JOB");
    expect(LLM_CITATION_JOB).toBe("llm-citation-sweep");
  });

  it("runs on its own queue, not the email one", () => {
    expect(worker).toContain("llmCitationQueueName");
    expect(worker).toContain("getLlmCitationQueue");
    const queue = readFileSync(join(process.cwd(), "lib", "queue.ts"), "utf8");
    expect(queue).toContain('llmCitationQueueName = "llm-citation"');
    // attempts: 1 — a retried sweep would re-bill the stores that succeeded.
    expect(queue.slice(queue.indexOf("getLlmCitationQueue"))).toContain(
      "attempts: 1",
    );
  });
});

// ── 6. What the dashboard is allowed to say ─────────────────────────────────

function row(over: Partial<CitationCheckRow> = {}): CitationCheckRow {
  return {
    id: "row-1",
    engine: "alpha",
    prompt: "q",
    cited: false,
    citedUrl: null,
    mentionText: null,
    checkedAt: "2026-08-17T04:00:00.000Z",
    ...over,
  };
}

describe("the dashboard summary", () => {
  it("tallies per engine and per run, newest first", () => {
    const summaries = summariseCitationChecks([
      row({ id: "1", engine: "alpha", cited: true, citedUrl: "a.example", mentionText: "linked" }),
      row({ id: "2", engine: "alpha" }),
      row({
        id: "3",
        engine: "alpha",
        checkedAt: "2026-08-10T04:00:00.000Z",
        cited: true,
        citedUrl: "old.example",
        mentionText: "older",
      }),
      row({ id: "4", engine: "beta" }),
    ]);

    expect(summaries.map((summary) => summary.engine)).toEqual(["alpha", "beta"]);
    expect(summaries[0]).toMatchObject({ checks: 3, cited: 2 });
    expect(summaries[0].runs).toEqual([
      { checkedAt: "2026-08-17T04:00:00.000Z", checks: 2, cited: 1 },
      { checkedAt: "2026-08-10T04:00:00.000Z", checks: 1, cited: 1 },
    ]);
    expect(summaries[0].latestMention?.id).toBe("1");
    expect(summaries[1]).toMatchObject({ checks: 1, cited: 0, latestMention: null });
  });

  it("says nothing about rankings or other companies' products", () => {
    const copy = Object.values(CITATION_MONITOR_COPY).join(" ");
    expect(copy).toMatch(/not a ranking/i);
    expect(copy).toMatch(/your own Automatos/i);
    expect(copy).not.toMatch(/\bguarantee/i);
    expect(copy).not.toMatch(/\bimprove your (ranking|position)/i);
  });
});

describe("the client parser", () => {
  it("drops a row missing its engine, prompt or timestamp", () => {
    expect(parseCitationCheck({ id: "1", prompt: "q", checkedAt: "t" })).toBeNull();
    expect(parseCitationCheck({ id: "1", engine: "a", checkedAt: "t" })).toBeNull();
    expect(parseCitationCheck({ id: "1", engine: "a", prompt: "q" })).toBeNull();
    expect(parseCitationCheck("not an object")).toBeNull();
  });

  it("refuses to read anything but a literal true as a citation", () => {
    const parsed = parseCitationCheck({
      id: "1",
      engine: "a",
      prompt: "q",
      checkedAt: "t",
      cited: "true",
      citedUrl: "greenleaf.example",
      mentionText: "linked",
    });
    expect(parsed).toMatchObject({ cited: false, citedUrl: null, mentionText: null });
  });

  it("treats an unreadable body as unreadable, not as an empty store", () => {
    expect(parseCitationsBody({ checks: "nope" })).toBeNull();
    expect(parseCitationsBody("<html>502</html>")).toBeNull();
    expect(parseCitationsBody({ checks: [] })).toEqual({
      connected: true,
      checks: [],
    });
  });

  it("only shows the connect card when the server said not connected", () => {
    expect(parseCitationsBody({ connected: false, checks: [] })?.connected).toBe(
      false,
    );
    // Absent — we could not tell, so do not tell a connected store to connect.
    expect(parseCitationsBody({ checks: [] })?.connected).toBe(true);
  });
});
