import { Suspense } from "react";
import { AcceptInviteClient } from "./accept-invite-client";

// Fully client-driven (reads ?token via useSearchParams, fetches the preview) so
// it works for logged-out invitees. Must be a PUBLIC route (see middleware.ts).
// Suspense boundary is required by Next for useSearchParams during build.
export const dynamic = "force-dynamic";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteClient />
    </Suspense>
  );
}
