import { describe, expect, it } from "vitest";

import { FEATURES } from "@/lib/entitlements/features";
import { chatbotEnableForbidden } from "@/lib/entitlements/toggle-guards";

const ENTITLED = [FEATURES.AUTOMATOS_CHATBOT as string];
const NOT_ENTITLED: string[] = [];

describe("chatbotEnableForbidden (US-005)", () => {
  it("blocks turning ON without the entitlement", () => {
    expect(chatbotEnableForbidden(true, false, NOT_ENTITLED)).toBe(true);
  });

  it("allows turning ON with the entitlement", () => {
    expect(chatbotEnableForbidden(true, false, ENTITLED)).toBe(false);
  });

  it("allows turning OFF regardless of entitlement", () => {
    expect(chatbotEnableForbidden(false, true, NOT_ENTITLED)).toBe(false);
    expect(chatbotEnableForbidden(false, true, ENTITLED)).toBe(false);
  });

  it("allows a grandfathered tenant to keep the toggle on after lockdown", () => {
    // Saving unrelated settings with the flag already true must not 403.
    expect(chatbotEnableForbidden(true, true, NOT_ENTITLED)).toBe(false);
  });

  it("ignores an absent field (settings save without the toggle)", () => {
    expect(chatbotEnableForbidden(undefined, false, NOT_ENTITLED)).toBe(false);
    expect(chatbotEnableForbidden(undefined, true, NOT_ENTITLED)).toBe(false);
  });
});
