
import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ClerkProvider } from '@clerk/nextjs';
import { LanguageProvider } from '@/lib/i18n';
import { QueryProvider } from '@/components/query-provider';
import { SessionExpirationChecker } from '@/components/session-expiration-checker';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'BudStack - Medical Cannabis SaaS Platform',
  description: 'Multi-tenant SaaS platform for medical cannabis dispensaries. Launch and manage your dispensary with ease.',
  keywords: 'medical cannabis, dispensary platform, SaaS, multi-tenant, cannabis business',
  authors: [{ name: 'BudStack' }],
  openGraph: {
    title: 'BudStack - Medical Cannabis SaaS Platform',
    description: 'Multi-tenant SaaS platform for medical cannabis dispensaries',
    url: 'https://budstack.to',
    siteName: 'BudStack',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BudStack - Medical Cannabis SaaS',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
                <Toaster />
              </ThemeProvider>
            </LanguageProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
