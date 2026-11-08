// [Phase: MVP v1] Root Application Layout with Railway Dot-Matrix Theme & i18n
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getActiveLocale } from '@/lib/i18n/request';
import { Navbar } from '@/components/layout/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Dota turnir — Платформа турниров по Dota 2',
    template: '%s | Dota turnir',
  },
  description:
    'Dota turnir — веб-платформа для организации турниров по Dota 2 с авторизацией через Steam OpenID 2.0, командами, интерактивным холстом сеток и статистикой OpenDota.',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Dota turnir — Платформа турниров по Dota 2',
    description:
      'Интерактивные турнирные сетки, каталог команд, двухстороннее подтверждение матчей и независимый рейтинг.',
    type: 'website',
    images: ['/logo.png'],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, messages] = await Promise.all([
    getActiveLocale(),
    getMessages(),
  ]);

  return (
    <html lang={locale} className="dark">
      <body className="bg-dot-matrix min-h-screen flex flex-col antialiased selection:bg-accent selection:text-white">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Navbar />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-glass-border bg-bg/90 py-6 mt-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon.png"
                  alt="Dota turnir"
                  className="h-6 w-6 object-contain"
                />
                <span>
                  <strong className="text-text">Dota turnir</strong> — Платформа турниров по Dota 2 (MVP v1).
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span>Steam OpenID 2.0</span>
                <span>•</span>
                <span>OpenDota API</span>
                <span>•</span>
                <span>React Flow Canvas</span>
              </div>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
