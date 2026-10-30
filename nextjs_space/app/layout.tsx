
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ClerkProvider } from '@clerk/nextjs';
import { LanguageProvider } from '@/lib/i18n';
import { QueryProvider } from '@/components/query-provider';
import { SessionKeepAlive } from '@/components/session-keep-alive';
import { GlobalPlatformChatbot } from '@/components/landing/GlobalPlatformChatbot';
import { CookieBanner } from '@/components/legal/CookieBanner';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import {
  PLATFORM_DEFAULT_DESCRIPTION,
  PLATFORM_DEFAULT_TITLE,
} from '@/lib/seo/platform-page-metadata';

// Fonts are self-hosted from app/fonts (the latin woff2 files Google Fonts
// serves for these families) so `next build` never fetches from Google.
// next/font/google crashes the build whenever Google returns an extensionless
// /l/font?kit= URL (vercel/next.js#99114) — it intermittently failed prod deploys.
// Serif faces keep the Times New Roman metric fallback next/font/google used.
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
});
const playfair = localFont({
  src: './fonts/playfair-display-latin-wght-normal.woff2',
  weight: '400 900',
  variable: '--font-playfair',
  adjustFontFallback: 'Times New Roman',
});
const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-jetbrains-mono',
});
// Fraunces is the free fallback for GT Sectra (paid). Once GT Sectra is licensed,
// add @font-face declarations and it will take precedence in .budstacks-theme.
const fraunces = localFont({
  src: './fonts/fraunces-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-fraunces',
  adjustFontFallback: 'Times New Roman',
});
// Cormorant Garamond — Budstacks Admin Design System display serif (titles, big metrics).
// Google serves one variable file for 400/500/600, so a 400–600 range matches.
const cormorantGaramond = localFont({
  src: './fonts/cormorant-garamond-latin-wght-normal.woff2',
  weight: '400 600',
  variable: '--font-cormorant',
  adjustFontFallback: 'Times New Roman',
});

// Force dynamic rendering to avoid Clerk key requirement during build
export const dynamic = 'force-dynamic';

// US-015: the two strings below are the LAST-RESORT fallback for every
// marketing route, so they live in lib/seo/platform-page-metadata.ts and are
// imported here rather than repeated there. Everything else in this block is
// inherited only by pages that declare nothing of their own — the fifteen
// marketing routes now declare `openGraph`, `twitter` and (when a route is set
// to noindex) `robots`, each of which Next replaces wholesale.
export const metadata: Metadata = {
  title: PLATFORM_DEFAULT_TITLE,
  description: PLATFORM_DEFAULT_DESCRIPTION,
  keywords: 'medical cannabis, dispensary platform, SaaS, multi-tenant, cannabis business',
  authors: [{ name: 'BudStacks' }],
  openGraph: {
    title: 'BudStacks - Medical Cannabis SaaS Platform',
    description: 'Multi-tenant SaaS platform for medical cannabis dispensaries',
    url: 'https://budstacks.io',
    siteName: 'BudStacks',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BudStacks - Medical Cannabis SaaS',
    description: 'Launch and manage your medical cannabis dispensary',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch global platform settings to power the BudStacks marketing/home page Chatbot
  let platformApiKey = undefined;
  let platformAgentId = undefined;
  let platformBusinessName = undefined;
  let themeOverrides: Record<string, string> = {};
  try {
    const settings = await prisma.platform_settings.findUnique({
      where: { id: "platform" },
      select: {
        automatosApiKey: true,
        automatosAgentId: true,
        primaryColor: true,
        secondaryColor: true,
        backgroundColor: true,
        textColor: true,
        businessName: true,
      }
    });
    if (settings?.automatosApiKey) {
      platformApiKey = settings.automatosApiKey;
      platformAgentId = settings.automatosAgentId;
      platformBusinessName = settings.businessName;
    }

    // Convert DB colors to Automatos widget CSS variables
    if (settings) {
      themeOverrides = {
        "--aw-primary": settings.primaryColor,
        "--aw-primary-hover": settings.secondaryColor || settings.primaryColor,
        // Force a light, high-contrast background for the widget
        "--aw-bg": "#ffffff",
        "--aw-text": "#1a1a1a",
        "--aw-user-text": "#1a1a1a",
      };

      // Remove any undefined or empty override values
      Object.keys(themeOverrides).forEach(key => {
        if (!themeOverrides[key]) delete themeOverrides[key];
      });
    }
  } catch (e) {
    console.error("Failed to load platform settings in root layout", e);
  }

  // Clerk proxy mode requires each domain registered in Clerk Dashboard —
  // doesn't scale for per-tenant custom domains. Instead, let Clerk use its
  // standard auth flow (redirect to accounts.dev and back). Works on any domain.

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${cormorantGaramond.variable} font-sans antialiased`}>
        <ClerkProvider
          // PRD-218 AC-2a: `dynamic` makes Clerk resolve the per-request nonce
          // from the x-nonce request header (set in middleware) and apply it to
          // its injected scripts. Without it Clerk emits un-nonced scripts that
          // 'strict-dynamic' blocks. An explicit `nonce` prop is NOT honoured at
          // this Clerk version — it is overridden by Clerk's own header read.
          dynamic
          appearance={{
            elements: {
              // Ensure consistent styling
            },
          }}
        >
          <QueryProvider>
            <LanguageProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem
                disableTransitionOnChange
              >
                <SessionKeepAlive />
                {children}
                {platformApiKey && (
                  <GlobalPlatformChatbot
                    automatosApiKey={platformApiKey}
                    automatosAgentId={platformAgentId ?? undefined}
                    themeOverrides={themeOverrides}
                    businessName={platformBusinessName ?? undefined}
                  />
                )}
                <Toaster />
                <CookieBanner />
              </ThemeProvider>
            </LanguageProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
