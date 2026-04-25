
import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono, Fraunces } from 'next/font/google';
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

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });
// Fraunces is the free fallback for GT Sectra (paid). Once GT Sectra is licensed,
// add @font-face declarations and it will take precedence in .budstacks-theme.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });

// Force dynamic rendering to avoid Clerk key requirement during build
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'BudStacks - Medical Cannabis SaaS Platform',
  description: 'Multi-tenant SaaS platform for medical cannabis dispensaries. Launch and manage your dispensary with ease.',
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
      <body className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${fraunces.variable} font-sans antialiased`}>
        <ClerkProvider
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
