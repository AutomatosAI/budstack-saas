import { describe, expect, it } from "vitest";
import { redactQueryForLog } from "@/lib/drgreen/drgreen-api-client";

/**
 * BS-F01: the checkout delivery quote narrows GET /dapp/carts with
 * `search=<customer email>`. The request URL is logged on every call, so the
 * email must be redacted there.
 */
describe("redactQueryForLog", () => {
  it("redacts the search value wherever it sits in the query", () => {
    expect(redactQueryForLog("https://x/api/v1/dapp/carts?search=ann%40example.com")).toBe(
      "https://x/api/v1/dapp/carts?search=<redacted>",
    );
    expect(redactQueryForLog("https://x/a?take=10&search=ann%40example.com&page=1")).toBe(
      "https://x/a?take=10&search=<redacted>&page=1",
    );
  });

  it("leaves other URLs alone", () => {
    const url = "https://x/api/v1/dapp/strains?countryCode=ZAF&orderBy=desc&take=100&page=1";
    expect(redactQueryForLog(url)).toBe(url);
  });
});
