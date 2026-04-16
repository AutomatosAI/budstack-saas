"use client";

import { useSession, useClerk, useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

/**
 * Keeps the Clerk session alive while the user is on the site.
 *
 * 1. Refreshes the session token every REFRESH_INTERVAL_MS (4 min)
 *    — well inside Clerk's ~5-min short-lived JWT window.
 * 2. On tab refocus (visibility change), immediately refreshes the token
 *    so a user returning from sleep/idle can save without a 500.
 * 3. Warns the user WARNING_BEFORE_EXPIRY_MS before the session's
 *    max lifetime expires (the long-lived session, not the JWT).
 * 4. Only signs out when the session is truly dead.
 */

const REFRESH_INTERVAL_MS = 4 * 60 * 1000;       // 4 minutes
const WARNING_BEFORE_EXPIRY_MS = 5 * 60 * 1000;  // warn 5 min before hard expiry

export function SessionKeepAlive() {
  const { session } = useSession();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const warningShownRef = useRef(false);
  const lastRefreshRef = useRef(Date.now());

  // Force Clerk to issue a fresh short-lived JWT
  const refreshToken = useCallback(async () => {
    try {
      await getToken({ skipCache: true });
      lastRefreshRef.current = Date.now();
    } catch {
      // Token refresh failed — session is likely dead
      console.warn("[session-keep-alive] Token refresh failed");
    }
  }, [getToken]);

  // Periodic refresh — keeps the JWT alive while the tab is open
  useEffect(() => {
    if (!session) return;

    const intervalId = setInterval(refreshToken, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [session, refreshToken]);

  // Tab refocus — immediately refresh after returning from sleep/idle
  useEffect(() => {
    if (!session) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      const elapsed = Date.now() - lastRefreshRef.current;
      // Only refresh if more than 60s since last refresh (avoid double-fire)
      if (elapsed > 60_000) {
        refreshToken();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [session, refreshToken]);

  // Session max-lifetime expiry warning + sign-out
  useEffect(() => {
    if (!session) return;

    const expireAt = session.expireAt;
    if (!expireAt) return;

    const expirationTime = new Date(expireAt).getTime();
    const now = Date.now();
    const timeUntilExpiration = expirationTime - now;

    // Already expired — sign out
    if (timeUntilExpiration <= 0) {
      signOut({ redirectUrl: "/auth/login" });
      return;
    }

    // Schedule warning toast before hard expiry
    const timeUntilWarning = timeUntilExpiration - WARNING_BEFORE_EXPIRY_MS;
    let warningTimeout: NodeJS.Timeout | undefined;

    if (timeUntilWarning > 0 && !warningShownRef.current) {
      warningTimeout = setTimeout(() => {
        warningShownRef.current = true;
        toast.warning("Your session expires in 5 minutes — save your work.", {
          duration: 15_000,
        });
      }, timeUntilWarning);
    }

    // Schedule sign-out at actual expiry (with 5s buffer)
    const expiryTimeout = setTimeout(() => {
      toast.error("Session expired. Redirecting to login...", { duration: 3000 });
      setTimeout(() => signOut({ redirectUrl: "/auth/login" }), 3000);
    }, timeUntilExpiration + 5000);

    return () => {
      if (warningTimeout) clearTimeout(warningTimeout);
      clearTimeout(expiryTimeout);
    };
  }, [session, signOut]);

  return null;
}
