"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

import {
  NEWSLETTER_NOTICE_COPY,
  NEWSLETTER_NOTICE_PARAM,
  isNewsletterNotice,
} from "@/lib/email/newsletter-confirm";

/**
 * The storefront half of double opt-in (US-003): the confirm endpoint redirects
 * back here with `?newsletter=<outcome>` and this renders the result inside the
 * tenant's own branding rather than on a bare API page.
 *
 * The outcome is read from the URL, never from the subscriber record, so the
 * banner cannot leak whether an address is on any list.
 */
function NewsletterNoticeInner() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const value = searchParams.get(NEWSLETTER_NOTICE_PARAM);
  if (dismissed || !isNewsletterNotice(value)) return null;

  const { tone, title, body } = NEWSLETTER_NOTICE_COPY[value];
  const isSuccess = tone === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 border-b px-4 py-3 text-sm ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="opacity-90">{body}</p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-1 hover:bg-black/5"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function NewsletterNotice() {
  // useSearchParams needs a boundary or the whole storefront route opts out of
  // static rendering at build time.
  return (
    <Suspense fallback={null}>
      <NewsletterNoticeInner />
    </Suspense>
  );
}
