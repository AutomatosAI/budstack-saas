"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RowPill } from "@/components/admin/shared/RowPill";
import {
  EMAIL_LOG_STATUS_LABEL,
  EMAIL_LOG_STATUS_TONE,
  type EmailLogRow,
} from "./email-log-types";

interface EmailLogDetailDrawerProps {
  log: EmailLogRow | null;
  onClose: () => void;
}

const TIMESTAMP_FORMAT = "d MMM yyyy, HH:mm:ss";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-bs-fg-muted">
        {label}
      </dt>
      <dd className="break-words text-sm text-bs-fg">{children}</dd>
    </div>
  );
}

/**
 * Raw SMTP output. Rendered inside a <pre> as text — never as markup — because
 * the string comes straight from the tenant's mail server.
 */
function RawBlock({ value }: { value: string }) {
  return (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bs-card-2 p-3 font-mono text-xs text-bs-fg">
      {value}
    </pre>
  );
}

/** US-007 — per-message detail, including why a send failed. */
export function EmailLogDetailDrawer({ log, onClose }: EmailLogDetailDrawerProps) {
  return (
    <Sheet open={Boolean(log)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {log && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left">{log.subject}</SheetTitle>
              <SheetDescription className="text-left">
                Delivery detail for a single message.
              </SheetDescription>
            </SheetHeader>

            <dl className="mt-6 space-y-5">
              <Field label="Status">
                <RowPill tone={EMAIL_LOG_STATUS_TONE[log.status]}>
                  {EMAIL_LOG_STATUS_LABEL[log.status]}
                </RowPill>
              </Field>
              <Field label="Recipient">
                <span className="font-mono">{log.recipient}</span>
              </Field>
              <Field label="Template">{log.templateName}</Field>
              <Field label="Queued">
                {format(new Date(log.createdAt), TIMESTAMP_FORMAT)}
              </Field>
              <Field label="Sent">
                {log.sentAt
                  ? format(new Date(log.sentAt), TIMESTAMP_FORMAT)
                  : "Not yet sent"}
              </Field>
              <Field label="SMTP response">
                {log.smtpResponse ? (
                  <RawBlock value={log.smtpResponse} />
                ) : (
                  <span className="text-bs-fg-muted">None recorded</span>
                )}
              </Field>
              <Field label="Error">
                {log.errorMessage ? (
                  <RawBlock value={log.errorMessage} />
                ) : (
                  <span className="text-bs-fg-muted">None</span>
                )}
              </Field>
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
