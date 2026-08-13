import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

import {
  EMAIL_CARD_WIDTH_PX,
  EMAIL_CONTENT_PADDING_PX,
} from "@/lib/email/email-layout";

/**
 * US-010 — the branded chrome every authored email is wrapped in.
 *
 * An author only ever edits the message body; the logo, the brand colour and
 * the compliance footer are applied here so they cannot be deleted, mistyped or
 * forgotten. Purely presentational: it takes finished values and renders them.
 * The server util (`lib/email/email-shell.ts`) is what resolves the tenant's
 * logo into an absolute URL, reads the postal address and decides whether an
 * unsubscribe line belongs in this message at all.
 *
 * TWO CONSTRAINTS SHAPE EVERY STYLE BELOW.
 *
 * 1. `lib/security/email-sanitize.ts` runs LAST over the finished document and
 *    drops any CSS property that is not on its allow-list. So this component
 *    uses only allow-listed properties, and only in the shapes those regexes
 *    accept — longhand `paddingTop`/`marginBottom` rather than the multi-value
 *    `padding: "24px 32px"` shorthand, which the allow-list rejects wholesale.
 *    The rule is one-directional: if something here does not survive, change
 *    this file, never the sanitizer.
 * 2. Buttons in email are styled `<a>` elements — `<button>` is not on the
 *    allow-list and does not work in most clients regardless.
 *
 * KNOWN CONSEQUENCE: the sanitizer drops the XHTML doctype react-email emits
 * (a directive, not an allow-listed tag), so the stored document starts at
 * `<html>`. That is the sanitizer's call and is not worked around here; a send
 * path that wants a doctype must prepend one AFTER sanitization, never by
 * widening the allow-list.
 */

/** Matches the `tenant_branding.primaryColor` column default. */
export const DEFAULT_EMAIL_PRIMARY_COLOR = "#10b981";

const FONT_STACK = "Helvetica, Arial, sans-serif";
const TEXT_COLOR = "#1f2937";
const MUTED_COLOR = "#6b7280";
const BORDER_COLOR = "#e5e7eb";
const PAGE_BACKGROUND = "#f4f4f5";
const CARD_BACKGROUND = "#ffffff";

const page: React.CSSProperties = {
  backgroundColor: PAGE_BACKGROUND,
  fontFamily: FONT_STACK,
  color: TEXT_COLOR,
  margin: "0",
  paddingTop: "24px",
  paddingBottom: "24px",
};

const card: React.CSSProperties = {
  backgroundColor: CARD_BACKGROUND,
  // US-014: the card width and the content padding below are what
  // `EMAIL_CONTENT_WIDTH_PX` is derived from — the width an inserted image is
  // clamped to. They are imported rather than restated so the composer cannot
  // size content for a card this file has since resized.
  maxWidth: `${EMAIL_CARD_WIDTH_PX}px`,
  width: "100%",
  margin: "0 auto",
  borderRadius: "8px",
};

/** The brand accent: a rule across the top of the card. */
const accentBar = (primaryColor: string): React.CSSProperties => ({
  backgroundColor: primaryColor,
  height: "4px",
  width: "100%",
  fontSize: "1px",
  lineHeight: "1px",
});

const header: React.CSSProperties = {
  paddingTop: "24px",
  paddingBottom: "8px",
  paddingLeft: "32px",
  paddingRight: "32px",
  textAlign: "center",
};

const wordmark = (primaryColor: string): React.CSSProperties => ({
  color: primaryColor,
  fontFamily: FONT_STACK,
  fontSize: "20px",
  fontWeight: "bold",
  lineHeight: "28px",
  margin: "0",
  textAlign: "center",
});

const content: React.CSSProperties = {
  paddingTop: "8px",
  paddingBottom: "8px",
  paddingLeft: `${EMAIL_CONTENT_PADDING_PX}px`,
  paddingRight: `${EMAIL_CONTENT_PADDING_PX}px`,
};

/** Typography the authored body inherits when it sets none of its own. */
const contentText: React.CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: "16px",
  lineHeight: "24px",
  color: TEXT_COLOR,
};

const divider: React.CSSProperties = {
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: BORDER_COLOR,
  width: "100%",
  marginTop: "24px",
  marginBottom: "0",
};

const footer: React.CSSProperties = {
  paddingTop: "16px",
  paddingBottom: "24px",
  paddingLeft: "32px",
  paddingRight: "32px",
};

const footerText: React.CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: "12px",
  lineHeight: "18px",
  color: MUTED_COLOR,
  margin: "0",
  textAlign: "center",
};

const footerLink: React.CSSProperties = {
  color: MUTED_COLOR,
  fontSize: "12px",
  textDecoration: "underline",
};

export interface EmailShellProps {
  /** Display name in the header wordmark and the footer attribution. */
  readonly businessName: string;
  /** The authored message. Trusted here; the pipeline sanitizes it last. */
  readonly bodyHtml: string;
  /** ABSOLUTE logo URL — an inbox cannot resolve an origin-relative one. */
  readonly logoUrl?: string | null;
  readonly primaryColor?: string | null;
  /** Postal address. Omitted rather than faked when the tenant has none. */
  readonly businessAddress?: string | null;
  /** Unsubscribe target, or the `{{unsubscribeUrl}}` slot. Null hides the line. */
  readonly unsubscribeUrl?: string | null;
}

export const EmailShell = ({
  businessName = "BudStacks",
  bodyHtml = "",
  logoUrl,
  primaryColor,
  businessAddress,
  unsubscribeUrl,
}: EmailShellProps) => {
  const accent = primaryColor || DEFAULT_EMAIL_PRIMARY_COLOR;
  return (
    <Html>
      <Head />
      <Body style={page}>
        <Container style={card}>
          <Section style={accentBar(accent)}>&nbsp;</Section>
          <Section style={header}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt={businessName}
                height="48"
                style={{ height: "48px", margin: "0 auto" }}
              />
            ) : (
              <Text style={wordmark(accent)}>{businessName}</Text>
            )}
          </Section>
          <Section style={content}>
            <div
              style={contentText}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </Section>
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>{businessName}</Text>
            {businessAddress ? (
              <Text style={footerText}>{businessAddress}</Text>
            ) : null}
            {unsubscribeUrl ? (
              <Text style={footerText}>
                <Link
                  style={footerLink}
                  href={unsubscribeUrl}
                  rel="noopener noreferrer"
                >
                  Unsubscribe
                </Link>{" "}
                from marketing email.
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default EmailShell;
