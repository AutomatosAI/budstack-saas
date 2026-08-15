"use client";

import { useState } from "react";

/**
 * Homepage lead capture — the Operator 101 guide in exchange for an email.
 *
 * Posts to /api/platform/leads, which stores the address in platform_leads and
 * returns the download path. The consent tick is required by the endpoint, not
 * merely by this form, so a hand-rolled POST cannot skip it.
 */

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; download: string }
  | { kind: "error"; message: string };

export default function LeadMagnet() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });

    try {
      const res = await fetch("/api/platform/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "homepage-cta",
          consent,
          website,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setState({
          kind: "error",
          message:
            data?.error ||
            "That did not go through. Please check the address and try again.",
        });
        return;
      }

      setState({ kind: "done", download: data.download });
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the server. Please try again in a moment.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <section className="border-t border-bs-border px-5 py-20 sm:px-10 lg:px-20">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="font-bs-serif text-3xl text-bs-gold-300">
            It&rsquo;s yours — enjoy
          </h2>
          <p className="mt-3 text-bs-fg-1">
            The Operator 101 guide covers both licence paths, all three tiers,
            and the economics behind every gram sold.
          </p>
          <a
            href={state.download}
            className="bs-btn bs-btn-primary mt-6 inline-block"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the guide (PDF)
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-bs-border px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-[640px] text-center">
        <span className="bs-chip bs-chip-gold">Free guide</span>

        <h2 className="font-bs-serif mt-5 text-3xl text-bs-gold-300 sm:text-4xl">
          Thinking about running your own storefront?
        </h2>
        <p className="mt-3 text-lg text-bs-fg-1">
          Operator 101 walks through both licence paths, what each tier unlocks,
          and the real economics — margin per gram, overhead, and where the
          profit share goes. Twenty pages, no sales call.
        </p>

        <form onSubmit={onSubmit} className="mt-8 text-left">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="lead-email" className="sr-only">
              Email address
            </label>
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              autoComplete="email"
              className="flex-1 rounded-bs-md border border-bs-border bg-bs-bg-1 px-4 py-3 text-bs-fg-0 placeholder:text-bs-fg-2 focus:border-bs-green-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={state.kind === "sending"}
              className="bs-btn bs-btn-primary whitespace-nowrap disabled:opacity-60"
            >
              {state.kind === "sending" ? "Sending…" : "Send me the guide"}
            </button>
          </div>

          {/* Honeypot — hidden from people, catnip for bots. */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="lead-website">Website</label>
            <input
              id="lead-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm text-bs-fg-2">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-bs-green-500"
            />
            <span>
              I agree to BudStacks contacting me about operating a storefront,
              and to the storage of my email address for that purpose. I can
              unsubscribe at any time.
            </span>
          </label>

          {state.kind === "error" && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
