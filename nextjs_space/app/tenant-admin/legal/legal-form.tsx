"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, Loader2, Lock } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import type { LegalProfileInput } from "@/lib/legal/legal-profile-schema";

interface Props {
  initial: LegalProfileInput;
  publishedAt: string | null;
  publishedVersion: string | null;
  currentVersion: string;
  storefrontUrl: string;
}

type Field = keyof LegalProfileInput;

const FIELDS: ReadonlyArray<{
  name: Field;
  label: string;
  help: string;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
}> = [
  {
    name: "controllerLegalName",
    label: "Legal entity name",
    help: "The registered company that is the data controller — not your trading or brand name, unless they are the same.",
    required: true,
    placeholder: "HealingBuds Ltd",
  },
  {
    name: "registeredAddress",
    label: "Registered address",
    help: "The company's registered address. This appears in your privacy notice as the controller's address.",
    required: true,
    multiline: true,
    placeholder: "12 Example Street, London EC1A 1AA, United Kingdom",
  },
  {
    name: "privacyContactEmail",
    label: "Privacy contact email",
    help: "Where customers send data protection requests. It must be monitored — you have one month to respond by law.",
    required: true,
    placeholder: "privacy@yourcompany.com",
  },
  {
    name: "icoRegistrationNumber",
    label: "Data protection registration number",
    help: "Optional. Your ICO registration number, or the equivalent in your country.",
    placeholder: "ZA123456",
  },
  {
    name: "dpoName",
    label: "Data Protection Officer",
    help: "Optional. Only if you have appointed one.",
    placeholder: "Jordan Reeves",
  },
  {
    name: "dpoContact",
    label: "DPO contact",
    help: "Optional. Shown only when a DPO is named above.",
    placeholder: "dpo@yourcompany.com",
  },
  {
    name: "ukRepresentative",
    label: "UK representative (Article 27)",
    help: "Optional. Required only if your company is established outside the UK but offers services to UK customers.",
    placeholder: "LHI Consulting Ltd, 1 Example Road, London",
  },
  {
    name: "tradingName",
    label: "Trading name",
    help: "Optional. Only if you trade under a name different from the legal entity above.",
    placeholder: "HealingBuds",
  },
  {
    name: "supportContactEmail",
    label: "Customer support email",
    help: "Where customers raise order problems and complaints. Required for your terms of sale.",
    placeholder: "support@yourcompany.com",
  },
  {
    name: "governingLaw",
    label: "Governing law",
    help: "The law your terms of sale operate under. Required for your terms of sale.",
    placeholder: "England and Wales",
  },
  {
    name: "regulatorName",
    label: "Your regulator",
    help: "Who regulates your activity. Required for your regulatory information page.",
    placeholder: "the MHRA",
  },
  {
    name: "licenceNumber",
    label: "Licence number",
    help: "Optional. Shown on your regulatory information page when provided.",
    placeholder: "MHRA-12345",
  },
  {
    name: "deliveryTerms",
    label: "Delivery terms",
    help: "Optional. Your dispatch times and delivery arrangements, in your own words.",
    placeholder: "We dispatch within 2 working days. Tracked delivery is included.",
    multiline: true,
  },
  {
    name: "returnsPolicy",
    label: "Returns",
    help: "Optional. Returns beyond the statutory minimum. Prescribed medicines cannot be returned once dispatched — that is stated for you.",
    placeholder: "Unopened accessories may be returned within 14 days.",
    multiline: true,
  },
];

export default function LegalProfileForm({
  initial,
  publishedAt,
  publishedVersion,
  currentVersion,
  storefrontUrl,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<LegalProfileInput>(initial);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const isPublished = Boolean(publishedAt);

  const update = useCallback((name: Field, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const post = useCallback(
    async (publish: boolean) => {
      const res = await fetch("/api/tenant-admin/legal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, publish }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save your details.");
      return json;
    },
    [values],
  );

  const onSave = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      try {
        await post(publish);
        toast.success(
          publish
            ? "Privacy policy published to your storefront."
            : "Draft saved. It is not live until you publish.",
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setSaving(false);
      }
    },
    [post, router],
  );

  const onPreview = useCallback(async () => {
    setPreviewing(true);
    try {
      const res = await fetch("/api/tenant-admin/legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not build a preview.");
      setPreviewHtml(json.html);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPreviewing(false);
    }
  }, [values]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-bs-fg">Privacy policy</h1>
        <p className="mt-2 max-w-2xl text-sm text-bs-fg-2">
          Your storefront needs a privacy notice naming your company. You are the
          data controller for your customers&apos; information, so the notice has
          to be yours — not ours.
        </p>
      </header>

      {isPublished ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="text-sm">
            <p className="font-medium text-bs-fg">Published and live</p>
            <p className="mt-1 text-bs-fg-2">
              Your notice is being served at{" "}
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                {storefrontUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
              .
              {publishedVersion && publishedVersion !== currentVersion && (
                <>
                  {" "}
                  You published version {publishedVersion}; version{" "}
                  {currentVersion} is now available. Republish to adopt it.
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-bs-fg">Not published yet</p>
            <p className="mt-1 text-bs-fg-2">
              Until you publish, your storefront tells visitors that no privacy
              policy is available. Fill in the details below and publish.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-5">
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="block text-sm font-medium text-bs-fg"
              >
                {field.label}
                {field.required && <span className="ml-1 text-amber-400">*</span>}
              </label>
              {field.multiline ? (
                <textarea
                  id={field.name}
                  rows={3}
                  value={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => update(field.name, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 text-sm text-bs-fg outline-none focus:border-bs-green"
                />
              ) : (
                <input
                  id={field.name}
                  type="text"
                  value={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => update(field.name, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 text-sm text-bs-fg outline-none focus:border-bs-green"
                />
              )}
              <p className="mt-1.5 text-xs text-bs-fg-2">{field.help}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-bs-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-bs-fg">
              <Lock className="h-4 w-4" />
              Standard wording — maintained by BudStacks
            </div>
            <p className="mt-2 text-xs leading-relaxed text-bs-fg-2">
              These details are merged into the four legal documents published on
              your site — privacy, terms, cookies and regulatory information.
              Privacy is previewed below; the rest are managed under{" "}
              <strong>Legal pages</strong>, where you can also replace any of them
              with your own wording.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-bs-fg-2">
              Fields marked as required for a document must be filled before that
              document can publish. Terms needs a governing law and support
              address; regulatory needs your regulator.
            </p>
          </div>

          <button
            type="button"
            onClick={onPreview}
            disabled={previewing}
            className="inline-flex items-center gap-2 rounded-lg border border-bs-border px-4 py-2 text-sm text-bs-fg hover:border-bs-green disabled:opacity-50"
          >
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Preview
          </button>

          {previewHtml && (
            <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-bs-border p-4">
              <div
                className="legal-document text-sm"
                // Safe: server-rendered from our own template by an escape-first
                // renderer — see lib/legal/markdown.ts and its XSS tests.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-bs-border pt-6">
        <button
          type="button"
          onClick={() => onSave(true)}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-bs-green px-5 py-2.5 text-sm font-medium text-bs-bg hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPublished ? "Republish" : "Publish"}
        </button>
        <button
          type="button"
          onClick={() => onSave(false)}
          disabled={saving}
          className="rounded-lg border border-bs-border px-5 py-2.5 text-sm text-bs-fg hover:border-bs-green disabled:opacity-50"
        >
          Save draft
        </button>
      </div>
    </div>
  );
}
