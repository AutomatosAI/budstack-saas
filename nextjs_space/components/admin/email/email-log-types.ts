import type { RowPillTone } from "@/components/admin/shared/RowPill";
// Type-only import: erased at build time, so no server module reaches the
// client bundle while the status union still has a single source of truth.
import type { EmailLogStatus } from "@/lib/email/email-log-query";

/** One row of GET /api/tenant-admin/email-logs — dates arrive as ISO strings. */
export interface EmailLogRow {
  id: string;
  recipient: string;
  subject: string;
  templateName: string;
  status: EmailLogStatus;
  smtpResponse: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EmailLogListResponse {
  logs: EmailLogRow[];
  pagination: EmailLogPagination;
}

export const EMAIL_LOG_STATUS_TONE: Record<EmailLogStatus, RowPillTone> = {
  QUEUED: "amber",
  SENT: "emerald",
  FAILED: "red",
};

export const EMAIL_LOG_STATUS_LABEL: Record<EmailLogStatus, string> = {
  QUEUED: "Queued",
  SENT: "Sent",
  FAILED: "Failed",
};
