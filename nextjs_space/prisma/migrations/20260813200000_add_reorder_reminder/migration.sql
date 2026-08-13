-- Reorder-reminder automation (Email Phase 2, US-028).
--
-- Two columns on `users`, beside `marketingConsentAt` (US-023) — the customer's
-- own marketing state already lives on this row, and a reminder is a fact about
-- a person rather than about a campaign.
--
-- "reorderReminderAt" — when the automation last mailed this customer, or NULL
-- for never. This is the once-per-window guard, and it is enforced by a
-- CONDITIONAL write (`UPDATE ... WHERE "reorderReminderAt" IS NULL OR
-- "reorderReminderAt" <= cutoff`) rather than by a read-then-write, so two
-- sweeps racing each other cannot both claim the same customer. Nullable with
-- no default: every existing row predates the automation, and NULL means "never
-- reminded", never "reminded at the epoch".
--
-- "reorderReminderToken" — the opt-out credential the reminder's footer carries.
-- Minted on the FIRST reminder and never rotated: the link sits in a message
-- already in someone's inbox and following it has to keep working, which is the
-- same reason `campaign_recipients.unsubscribeToken` is never cleared.
--
-- UNIQUE on the token because it is looked up BY the token on an unauthenticated
-- storefront route (`lib/email/unsubscribe-token.ts`); the index is what makes
-- that lookup a probe rather than a scan, and the constraint is what makes two
-- customers sharing a credential impossible. In Postgres a UNIQUE index permits
-- many NULLs, so the overwhelming majority of rows — everyone never reminded —
-- are unaffected.
--
-- No index on "reorderReminderAt": the sweep already narrows by tenant, role and
-- order history before this column is read, and adding a fourth low-cardinality
-- index to the platform's busiest table to serve one daily job is not a trade
-- worth making.
--
-- Metadata-only change plus one index build on a live table.
--
-- See tasks/prd-email-authoring-campaigns.md (US-028).

ALTER TABLE "users" ADD COLUMN "reorderReminderAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "reorderReminderToken" TEXT;

CREATE UNIQUE INDEX "users_reorderReminderToken_key" ON "users"("reorderReminderToken");
