-- Per-recipient unsubscribe credential for campaign fan-out (Email Phase 2,
-- US-019).
--
-- A campaign reaches confirmed newsletter subscribers AND consented customers,
-- and the second group has no `newsletter_subscribers` row — so there is no
-- subscriber token to put in their footer link. Minting the token on the
-- delivery record instead gives every recipient a working one-click opt-out
-- (RFC 8058, US-020) whichever list they came from, and is what lets US-026
-- attribute an unsubscribe to the campaign that caused it.
--
-- Nullable because the column is added to an existing table; every row the
-- fan-out writes carries one. UNIQUE because it is a bearer credential: the
-- unsubscribe route resolves the recipient from this value alone.
ALTER TABLE "campaign_recipients" ADD COLUMN "unsubscribeToken" TEXT;

CREATE UNIQUE INDEX "campaign_recipients_unsubscribeToken_key"
    ON "campaign_recipients"("unsubscribeToken");
