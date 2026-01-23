"use client";

import { useSession, useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

/**
 * Component that checks for session expiration and automatically signs out users
 * when their session expires. This ensures sessions don't persist indefinitely.
 * 
 * Session timeout should be configured in Clerk Dashboard:
 * - Navigate to Sessions page
 * - Enable "Inactivity timeout" (e.g., 1 hour, 24 hours, etc.)
 * - Enable "Maximum lifetime" (e.g., 7 days, 30 days, etc.)
 */
export function SessionExpirationChecker() {
  const { session } = useSession();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!session) return;

    const expireAt = session.expireAt;
    if (!expireAt) return;

    const now = new Date();
    const expirationTime = new Date(expireAt);
    const timeUntilExpiration = expirationTime.getTime() - now.getTime();

    // If session has already expired, sign out immediately
    if (timeUntilExpiration <= 0) {
      console.log("Session expired, signing out...");
      signOut({ redirectUrl: "/auth/login" });
      return;
    }

    // Set a timeout to sign out when the session expires
    // Add a small buffer (5 seconds) to ensure we catch the expiration
    const timeoutId: NodeJS.Timeout = setTimeout(() => {
      console.log("Session expired, signing out...");
      signOut({ redirectUrl: "/auth/login" });
    }, timeUntilExpiration + 5000);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
    };
  }, [session, signOut]);

  return null; // This component doesn't render anything
}
