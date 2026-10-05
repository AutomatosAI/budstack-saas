/**
 * Customer-facing classification of a Dr Green client-create failure, lifted
 * out of app/api/consultation/submit/route.ts (BS-A02, to keep that route under
 * the 800-line lint ceiling). Behaviour-preserving: same checks, same order,
 * same copy, same status codes as the inline block it replaces.
 *
 * Only the stable `failureCode (statusCode)` is ever persisted; the upstream
 * message can echo submitted values and stays in the (redacted) logs.
 */
export interface DrGreenRegistrationFailure {
  userMessage: string;
  statusCode: number;
  failureCode: "PHONE_EXISTS" | "EMAIL_EXISTS" | "CONFLICT" | "BAD_REQUEST" | "UNKNOWN";
}

export function classifyDrGreenRegistrationError(errorMessage: string | undefined): DrGreenRegistrationFailure {
  const errorMsg = errorMessage || "";

  if (errorMsg.includes("Phone Number already exists") || errorMsg.includes("phone") && errorMsg.includes("exists")) {
    return {
      userMessage: "This phone number is already registered. Please use a different phone number or contact support.",
      statusCode: 409,
      failureCode: "PHONE_EXISTS",
    };
  }
  if (errorMsg.includes("email") && errorMsg.includes("exists")) {
    return {
      userMessage: "This email address is already registered. Please use a different email or try logging in.",
      statusCode: 409,
      failureCode: "EMAIL_EXISTS",
    };
  }
  if (errorMsg.includes("409")) {
    return {
      userMessage: "An account with these details already exists. Please use different details or contact support.",
      statusCode: 409,
      failureCode: "CONFLICT",
    };
  }
  if (errorMsg.includes("400")) {
    return {
      userMessage: "Invalid information provided. Please check your details and try again.",
      statusCode: 400,
      failureCode: "BAD_REQUEST",
    };
  }
  return {
    userMessage: "Registration failed. Please try again or contact support.",
    statusCode: 500,
    failureCode: "UNKNOWN",
  };
}
