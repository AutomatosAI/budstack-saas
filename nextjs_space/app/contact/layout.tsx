import type { Metadata } from "next";

import { generatePlatformRouteMetadata } from "@/lib/seo/generate-platform-metadata";

/**
 * US-015 — /contact's metadata lives here because `page.tsx` is a CLIENT
 * component (it carries the react-hook-form lead form), and a client component
 * cannot export `metadata` or `generateMetadata`. A layout is the standard Next
 * answer, and the cheaper one: converting the page to a server component would
 * mean splitting a working 286-line form for a `<title>`.
 *
 * The route has always served the root layout's title as a result. It is in the
 * seeded route list and in the super-admin editor, so authoring one is now a
 * save rather than a refactor.
 *
 * This wrapper renders its children and nothing else — no markup, no styling,
 * no segment config. The page's own output is unchanged.
 */
export function generateMetadata(): Promise<Metadata> {
  return generatePlatformRouteMetadata("/contact");
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
