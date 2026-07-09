import { AcceptInviteClient } from "./accept-invite-client";

// Fully client-driven (reads ?token via useSearchParams, fetches the preview) so
// it works for logged-out invitees. Must be a PUBLIC route (see middleware.ts).
export const dynamic = "force-dynamic";

export default function AcceptInvitePage() {
  return <AcceptInviteClient />;
}
