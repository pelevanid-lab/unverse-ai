import type { Metadata } from 'next';
import '../globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Toaster } from '@/components/ui/toaster';
import { CombinedProviders } from '@/components/providers/CombinedProviders';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Unverse | AI Creator Social Network',
  description: 'SocialFi, Creator Economy, AI Influencers, Token Economy',
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className={`antialiased min-h-screen bg-background text-foreground ${locale === 'ar' ? 'font-arabic' : 'font-body'}`}>
        <NextIntlClientProvider messages={messages}>
          <CombinedProviders>
            <div className="flex min-h-screen">
              <AppSidebar />
              <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
                  {children}
                </main>
              </div>
            </div>
            <MobileBottomNav />
            <Toaster />
          </CombinedProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
