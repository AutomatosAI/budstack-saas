import { describe, expect, it } from "vitest";
import { classifyDrGreenRegistrationError } from "@/lib/drgreen/registration-error";

/**
 * Lifted unchanged out of the consultation submit route (BS-A02 line budget).
 * Pins the order of the checks and the persisted failure codes.
 */
describe("classifyDrGreenRegistrationError", () => {
  it.each([
    ["Dr Green API error: 409 Phone Number already exists", 409, "PHONE_EXISTS"],
    ["the phone already exists", 409, "PHONE_EXISTS"],
    ["the email already exists", 409, "EMAIL_EXISTS"],
    ["Dr Green API error: 409", 409, "CONFLICT"],
    ["Dr Green API error: 400 Bad Request", 400, "BAD_REQUEST"],
    ["socket hang up", 500, "UNKNOWN"],
    ["", 500, "UNKNOWN"],
  ])("%j → %i %s", (message, statusCode, failureCode) => {
    const result = classifyDrGreenRegistrationError(message);
    expect(result.statusCode).toBe(statusCode);
    expect(result.failureCode).toBe(failureCode);
    expect(result.userMessage.length).toBeGreaterThan(0);
  });

  it("treats an undefined message as unknown", () => {
    expect(classifyDrGreenRegistrationError(undefined).failureCode).toBe("UNKNOWN");
  });

  it("checks phone before the bare 409", () => {
    expect(
      classifyDrGreenRegistrationError("409 conflict: phone exists").failureCode,
    ).toBe("PHONE_EXISTS");
  });
});
