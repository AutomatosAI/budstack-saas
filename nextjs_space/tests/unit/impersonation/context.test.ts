import { describe, it, expect } from "vitest";
import {
  getImpersonationContext,
  runWithImpersonationContextAsync,
  type ImpersonationAuditContext,
} from "@/lib/impersonation/context";

const CTX: ImpersonationAuditContext = {
  sessionId: "sess-1",
  superAdminClerkId: "clerk_admin",
  superAdminEmail: "support@budstacks.io",
};

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("impersonation audit context (AC-5 stamping)", () => {
  it("is null outside any binding", () => {
    expect(getImpersonationContext()).toBeNull();
  });

  it("binds for the whole async chain and tears down after", async () => {
    await runWithImpersonationContextAsync(CTX, async () => {
      expect(getImpersonationContext()?.sessionId).toBe("sess-1");
      await tick();
      // Still bound after awaiting — the lazy-promise trap is covered.
      expect(getImpersonationContext()?.sessionId).toBe("sess-1");
    });
    expect(getImpersonationContext()).toBeNull();
  });

  it("null ctx is a pure passthrough (the common non-impersonated request)", async () => {
    const result = await runWithImpersonationContextAsync(null, async () => {
      expect(getImpersonationContext()).toBeNull();
      return "ok";
    });
    expect(result).toBe("ok");
  });

  it("keeps concurrent requests isolated", async () => {
    const other: ImpersonationAuditContext = {
      sessionId: "sess-2",
      superAdminClerkId: "clerk_other",
      superAdminEmail: "other@budstacks.io",
    };
    await Promise.all([
      runWithImpersonationContextAsync(CTX, async () => {
        await tick();
        expect(getImpersonationContext()?.sessionId).toBe("sess-1");
      }),
      runWithImpersonationContextAsync(other, async () => {
        expect(getImpersonationContext()?.sessionId).toBe("sess-2");
        await tick();
        expect(getImpersonationContext()?.sessionId).toBe("sess-2");
      }),
      runWithImpersonationContextAsync(null, async () => {
        await tick();
        expect(getImpersonationContext()).toBeNull();
      }),
    ]);
  });

  it("propagates errors without leaking the binding", async () => {
    await expect(
      runWithImpersonationContextAsync(CTX, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(getImpersonationContext()).toBeNull();
  });
});
