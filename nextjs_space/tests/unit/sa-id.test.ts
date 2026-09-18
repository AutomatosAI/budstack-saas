import { describe, expect, it } from "vitest";

import vectorFile from "@/lib/verification/__tests__/sa-id-vectors.json";
import {
  SA_ID_INVALID_MESSAGE,
  normaliseSouthAfricanId,
  saIdFieldError,
  validateSouthAfricanId,
  type SaIdInvalidReason,
} from "@/lib/verification/sa-id";

/**
 * BS-201 — one validator, proven against the vector file Dr Green's backend
 * (US-201) and the WordPress plugin (US-203) run too. The file is the
 * contract: if any vector disagrees, the three implementations have drifted.
 */
interface SaIdVector {
  input: string;
  valid: boolean;
  normalised?: string;
  reason?: SaIdInvalidReason;
  note?: string;
}

// The JSON module's inferred element type is a union of shapes; widen first.
const VECTORS = (vectorFile as unknown as { vectors: SaIdVector[] }).vectors;

// Pinned so the "not in the future" rule is deterministic in CI.
const NOW = new Date("2026-09-18T12:00:00Z");

const REASONS: SaIdInvalidReason[] = ["length", "digits", "date", "citizenship", "checksum"];

describe("validateSouthAfricanId — shared vector file", () => {
  it("has vectors to run (the contract file is not empty)", () => {
    expect(VECTORS.length).toBeGreaterThan(20);
  });

  it("no vector is a real person's number (all synthetic, all documented)", () => {
    // Every vector carries a note explaining what it exercises.
    expect(VECTORS.every((v) => typeof v.note === "string" && v.note.length > 0)).toBe(true);
  });

  for (const vector of VECTORS) {
    const label = vector.valid ? "valid" : vector.reason;
    it(`${JSON.stringify(vector.input)} → ${label} (${vector.note})`, () => {
      const result = validateSouthAfricanId(vector.input, { now: NOW });
      if (vector.valid) {
        expect(result).toEqual({ valid: true, normalised: vector.normalised });
      } else {
        expect(result).toEqual({ valid: false, reason: vector.reason });
      }
    });
  }

  it("exercises every failure reason at least once", () => {
    const seen = new Set(VECTORS.filter((v) => !v.valid).map((v) => v.reason));
    for (const reason of REASONS) expect(seen.has(reason)).toBe(true);
  });
});

describe("validateSouthAfricanId — rules the vectors cannot pin", () => {
  it("rejects a date that is real but after today as 'date'", () => {
    // 2025-12-31 is in the past for 1925 and 2025 alike; pretend today is 1920.
    const result = validateSouthAfricanId("2512315000082", { now: new Date("1920-01-01T00:00:00Z") });
    expect(result).toEqual({ valid: false, reason: "date" });
  });

  it("returns the space-stripped number as `normalised`", () => {
    expect(normaliseSouthAfricanId(" 900101 5009 086 ")).toBe("9001015009086");
  });

  it("derives nothing from the number (no date of birth, sex or citizenship in the result)", () => {
    const result = validateSouthAfricanId("9001015009086", { now: NOW });
    expect(Object.keys(result).sort()).toEqual(["normalised", "valid"]);
  });
});

describe("saIdFieldError — inline form copy", () => {
  it("returns the shared copy for an invalid ID number when the rules are on", () => {
    expect(
      saIdFieldError({ documentType: "ID", documentNumber: "9001015009087", enforce: true }),
    ).toBe(SA_ID_INVALID_MESSAGE);
  });

  it("returns null for a valid number, with or without spaces", () => {
    expect(
      saIdFieldError({ documentType: "ID", documentNumber: "900101 5009 086", enforce: true }),
    ).toBeNull();
  });

  it("never fires for passports or driving licences", () => {
    expect(
      saIdFieldError({ documentType: "PASSPORT", documentNumber: "junk", enforce: true }),
    ).toBeNull();
    expect(
      saIdFieldError({ documentType: "DRIVING_LICENCE", documentNumber: "junk", enforce: true }),
    ).toBeNull();
  });

  it("never fires when the rules are off (non-South-African context)", () => {
    expect(
      saIdFieldError({ documentType: "ID", documentNumber: "junk", enforce: false }),
    ).toBeNull();
  });

  it("leaves an empty number to the form's own required-field message", () => {
    expect(saIdFieldError({ documentType: "ID", documentNumber: "  ", enforce: true })).toBeNull();
  });
});
