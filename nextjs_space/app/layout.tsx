
import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ClerkProvider } from '@clerk/nextjs';
import { LanguageProvider } from '@/lib/i18n';
import { QueryProvider } from '@/components/query-provider';
import { SessionExpirationChecker } from '@/components/session-expiration-checker';
import { GlobalPlatformChatbot } from '@/components/landing/GlobalPlatformChatbot';
import { prisma } from '@/lib/db';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

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
  try {
    const settings = await prisma.platform_settings.findUnique({
      where: { id: "platform" },
      select: {
        automatosApiKey: true,
        automatosAgentId: true,
      }
    });
    if (settings?.automatosApiKey) {
      platformApiKey = settings.automatosApiKey;
      platformAgentId = settings.automatosAgentId;
    }
  } catch (e) {
    console.error("Failed to load platform settings in root layout", e);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
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
                <SessionExpirationChecker />
                {children}
                {platformApiKey && (
                  <GlobalPlatformChatbot
                    automatosApiKey={platformApiKey}
                    automatosAgentId={platformAgentId ?? undefined}
                  />
                )}
                <Toaster />
              </ThemeProvider>
            </LanguageProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
