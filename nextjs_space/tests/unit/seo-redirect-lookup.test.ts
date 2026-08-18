import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isRedirectablePath,
  resetStoreRedirectCache,
  resolvePlatformRedirect,
  resolveStoreRedirect,
  storeRedirectScope,
  STORE_REDIRECTS_FEED_PATH,
} from "@/lib/seo/redirect-lookup";
import type { TenantHostHint } from "@/lib/parse-host";

/**
 * SEO Supercharge US-020 — the middleware side.
 *
 * What this pins is the COST MODEL as much as the behaviour: a warm cache must
 * make no fetch, a tenant with no redirects must make no fetch after the first,
 * and a feed that fails or hangs must leave the request alone rather than stall
 * a storefront. Those are the claims the story is graded on and the ones a
 * refactor is most likely to break silently.
 *
 * The feed is stubbed at `globalThis.fetch` — the module builds the URL itself,
 * so the stub also asserts that middleware asks the right question.
 */

const ORIGIN = "https://acme.budstacks.io";
const SUBDOMAIN_HINT: TenantHostHint = { kind: "subdomain", subdomain: "acme" };

let fetchMock: ReturnType<typeof vi.fn>;

function feedReturning(redirects: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ redirects }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  resetStoreRedirectCache();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFeed(mock: ReturnType<typeof vi.fn>) {
  fetchMock = mock;
  vi.stubGlobal("fetch", mock);
}

describe("storeRedirectScope", () => {
  it("keys a subdomain host with no base path", () => {
    expect(storeRedirectScope(SUBDOMAIN_HINT, "/old")).toEqual({
      key: "sub:acme",
      basePath: "",
    });
  });

  it("keys a custom domain by host", () => {
    expect(
      storeRedirectScope({ kind: "customDomain", host: "shop.example" }, "/old"),
    ).toEqual({ key: "cd:shop.example", basePath: "" });
  });

  it("keys dev's path-based routing by slug, carrying the prefix", () => {
    expect(storeRedirectScope(null, "/store/acme/old")).toEqual({
      key: "slug:acme",
      basePath: "/store/acme",
    });
  });

  it("returns null for the platform apex", () => {
    expect(storeRedirectScope(null, "/marketplace")).toBeNull();
  });
});

describe("isRedirectablePath", () => {
  it("skips platform plumbing", () => {
    for (const path of [
      "/api",
      "/api/store/x",
      "/_next/static/chunk.js",
      "/__clerk/handshake",
      "/tenant-admin/seo",
      "/super-admin",
      "/auth/login",
      "/onboarding",
    ]) {
      expect(isRedirectablePath(path), path).toBe(false);
    }
  });

  it("allows storefront paths", () => {
    for (const path of ["/", "/products", "/the-wire/post", "/api-guide"]) {
      expect(isRedirectablePath(path), path).toBe(true);
    }
  });
});

describe("resolveStoreRedirect", () => {
  it("redirects a matching path and asks the feed about the right host", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/new", statusCode: 301 }]));

    const decision = await resolveStoreRedirect({
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/old",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    });

    expect(decision).toEqual({ location: "/new", statusCode: 301 });

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe(STORE_REDIRECTS_FEED_PATH);
    expect(requested.searchParams.get("host")).toBe("acme.budstacks.io");
  });

  it("serves a warm cache without touching the network again", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/new", statusCode: 301 }]));

    const input = {
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/old",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    };
    await resolveStoreRedirect(input);
    await resolveStoreRedirect(input);
    await resolveStoreRedirect(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("costs one fetch for a tenant with NO redirects, then nothing", async () => {
    stubFeed(feedReturning([]));

    for (const pathname of ["/", "/products", "/the-wire/post"]) {
      const decision = await resolveStoreRedirect({
        origin: ORIGIN,
        host: "acme.budstacks.io",
        pathname,
        method: "GET",
        hint: SUBDOMAIN_HINT,
      });
      expect(decision).toBeNull();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never touches the network for a non-store host", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/new", statusCode: 301 }]));

    const decision = await resolveStoreRedirect({
      origin: "https://budstacks.io",
      host: "budstacks.io",
      pathname: "/marketplace",
      method: "GET",
      hint: null,
    });

    expect(decision).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never touches the network for a non-redirectable path", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/new", statusCode: 301 }]));

    const decision = await resolveStoreRedirect({
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/api/store/acme/products",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    });

    expect(decision).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves a POST alone — a 301 would drop the body", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/new", statusCode: 301 }]));

    const decision = await resolveStoreRedirect({
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/old",
      method: "POST",
      hint: SUBDOMAIN_HINT,
    });

    expect(decision).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("peels and restores the /store/{slug} prefix under dev routing", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/new", statusCode: 308 }]));

    const decision = await resolveStoreRedirect({
      origin: "http://localhost:3000",
      host: "localhost:3000",
      pathname: "/store/acme/old",
      method: "GET",
      hint: null,
    });

    expect(decision).toEqual({ location: "/store/acme/new", statusCode: 308 });
  });

  it("resolves a redirect to the store home as the base path", async () => {
    stubFeed(feedReturning([{ fromPath: "/old", toPath: "/", statusCode: 301 }]));

    expect(
      await resolveStoreRedirect({
        origin: ORIGIN,
        host: "acme.budstacks.io",
        pathname: "/old",
        method: "GET",
        hint: SUBDOMAIN_HINT,
      }),
    ).toEqual({ location: "/", statusCode: 301 });
  });

  it("fails open when the feed errors — the page renders as it always did", async () => {
    stubFeed(vi.fn(async () => new Response(null, { status: 500 })));

    const decision = await resolveStoreRedirect({
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/old",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    });

    expect(decision).toBeNull();
  });

  it("fails open when the feed rejects outright", async () => {
    stubFeed(vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));

    expect(
      await resolveStoreRedirect({
        origin: ORIGIN,
        host: "acme.budstacks.io",
        pathname: "/old",
        method: "GET",
        hint: SUBDOMAIN_HINT,
      }),
    ).toBeNull();
  });

  it("ignores rows it cannot trust — a status code it did not ask for", async () => {
    stubFeed(
      feedReturning([
        { fromPath: "/a", toPath: "/b", statusCode: 302 },
        { fromPath: "/c", toPath: 7, statusCode: 301 },
        { fromPath: "/d", toPath: "/e", statusCode: 308 },
      ]),
    );

    const base = {
      origin: ORIGIN,
      host: "acme.budstacks.io",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    };

    expect(
      await resolveStoreRedirect({ ...base, pathname: "/a" }),
    ).toBeNull();
    expect(
      await resolveStoreRedirect({ ...base, pathname: "/c" }),
    ).toBeNull();
    expect(await resolveStoreRedirect({ ...base, pathname: "/d" })).toEqual({
      location: "/e",
      statusCode: 308,
    });
  });

  it("treats a malformed body as no redirects rather than throwing", async () => {
    stubFeed(
      vi.fn(async () =>
        new Response("not json at all", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(
      await resolveStoreRedirect({
        origin: ORIGIN,
        host: "acme.budstacks.io",
        pathname: "/old",
        method: "GET",
        hint: SUBDOMAIN_HINT,
      }),
    ).toBeNull();
  });

  it("keys the cache per tenant — one store's table never answers another's", async () => {
    stubFeed(
      vi.fn(async (input: unknown) => {
        const host = new URL(String(input)).searchParams.get("host");
        const redirects =
          host === "acme.budstacks.io"
            ? [{ fromPath: "/old", toPath: "/acme-new", statusCode: 301 }]
            : [];
        return new Response(JSON.stringify({ redirects }), { status: 200 });
      }),
    );

    expect(
      await resolveStoreRedirect({
        origin: ORIGIN,
        host: "acme.budstacks.io",
        pathname: "/old",
        method: "GET",
        hint: SUBDOMAIN_HINT,
      }),
    ).toEqual({ location: "/acme-new", statusCode: 301 });

    expect(
      await resolveStoreRedirect({
        origin: "https://other.budstacks.io",
        host: "other.budstacks.io",
        pathname: "/old",
        method: "GET",
        hint: { kind: "subdomain", subdomain: "other" },
      }),
    ).toBeNull();
  });

  it("collapses a burst of cold requests into ONE fetch", async () => {
    // Definite assignment, not `| null`: the executor runs synchronously, and a
    // nullable `let` narrows to `null` at the call site below — `resolveFeed?.()`
    // then types as `never` and fails the build (TS2349).
    let resolveFeed!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFeed = resolve;
    });
    stubFeed(vi.fn(() => pending));

    const input = {
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/old",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    };
    const inFlight = Promise.all([
      resolveStoreRedirect(input),
      resolveStoreRedirect(input),
      resolveStoreRedirect(input),
    ]);

    // Let the three calls reach the shared in-flight promise before answering.
    await Promise.resolve();
    resolveFeed(
      new Response(
        JSON.stringify({
          redirects: [{ fromPath: "/old", toPath: "/new", statusCode: 301 }],
        }),
        { status: 200 },
      ),
    );

    const decisions = await inFlight;
    expect(decisions).toEqual([
      { location: "/new", statusCode: 301 },
      { location: "/new", statusCode: 301 },
      { location: "/new", statusCode: 301 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * Platform US-019 — the apex side. Same cache, same matcher, same fail-open
 * behaviour; a different table one query parameter away.
 */
describe("resolvePlatformRedirect", () => {
  const APEX_ORIGIN = "https://budstacks.io";
  const apexInput = (pathname: string) => ({
    origin: APEX_ORIGIN,
    host: "budstacks.io",
    pathname,
    method: "GET",
    hint: null as TenantHostHint,
  });

  it("301s a renamed post and asks the feed for the platform table", async () => {
    stubFeed(
      feedReturning([
        { fromPath: "/blog/old-post", toPath: "/blog/new-post", statusCode: 301 },
      ]),
    );

    expect(await resolvePlatformRedirect(apexInput("/blog/old-post"))).toEqual({
      location: "/blog/new-post",
      statusCode: 301,
    });

    const asked = new URL(fetchMock.mock.calls[0][0] as string);
    expect(asked.pathname).toBe(STORE_REDIRECTS_FEED_PATH);
    expect(asked.searchParams.get("scope")).toBe("platform");
  });

  it("leaves a tenant host alone without so much as a fetch", async () => {
    // The failure that would matter: a store's visitors resolving against
    // budstacks.io's table.
    stubFeed(feedReturning([{ fromPath: "/blog/old-post", toPath: "/x", statusCode: 301 }]));

    expect(
      await resolvePlatformRedirect({
        ...apexInput("/blog/old-post"),
        hint: SUBDOMAIN_HINT,
      }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves dev's path-based storefronts to the store table", async () => {
    stubFeed(feedReturning([{ fromPath: "/store/acme/old", toPath: "/x", statusCode: 301 }]));

    expect(await resolvePlatformRedirect(apexInput("/store/acme/old"))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never redirects a POST — a 301 would drop the body", async () => {
    stubFeed(feedReturning([{ fromPath: "/blog/old-post", toPath: "/blog/new-post", statusCode: 301 }]));

    expect(
      await resolvePlatformRedirect({
        ...apexInput("/blog/old-post"),
        method: "POST",
      }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never redirects platform plumbing", async () => {
    stubFeed(feedReturning([{ fromPath: "/super-admin", toPath: "/x", statusCode: 301 }]));

    expect(await resolvePlatformRedirect(apexInput("/super-admin"))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries on as before when the feed fails", async () => {
    stubFeed(vi.fn(async () => new Response("nope", { status: 500 })));

    expect(await resolvePlatformRedirect(apexInput("/blog/old-post"))).toBeNull();
  });

  it("keeps the platform table out of every tenant's cache slot", async () => {
    // One fetch for the apex, one for the store: distinct keys, and neither
    // answers with the other's rules.
    stubFeed(
      vi.fn(async (url: string) =>
        new Response(
          JSON.stringify({
            redirects: new URL(url).searchParams.get("scope") === "platform"
              ? [{ fromPath: "/blog/old-post", toPath: "/blog/new-post", statusCode: 301 }]
              : [{ fromPath: "/blog/old-post", toPath: "/tenant-page", statusCode: 301 }],
          }),
          { status: 200 },
        ),
      ),
    );

    const platform = await resolvePlatformRedirect(apexInput("/blog/old-post"));
    const store = await resolveStoreRedirect({
      origin: ORIGIN,
      host: "acme.budstacks.io",
      pathname: "/blog/old-post",
      method: "GET",
      hint: SUBDOMAIN_HINT,
    });

    expect(platform?.location).toBe("/blog/new-post");
    expect(store?.location).toBe("/tenant-page");
  });
});
