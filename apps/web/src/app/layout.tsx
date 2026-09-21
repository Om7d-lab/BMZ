import type { Metadata, Viewport } from 'next';
import { DEFAULT_LOCALE, LOCALE_DESCRIPTORS } from '@bmz/i18n';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BMZ Trade Lab',
    template: '%s · BMZ Trade Lab',
  },
  description:
    'A trading journal for traders who want evidence instead of memory. Log every fill, review every session, and find out what actually makes you money.',
  applicationName: 'BMZ Trade Lab',
};

export const viewport: Viewport = {
  // The browser chrome follows the theme the same way the page does.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1118' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_LOCALE;

  return (
    // dir comes from the locale registry, so switching to Persian or Arabic in
    // the localisation stage mirrors the whole interface without touching any
    // component: the layout is built on logical properties throughout.
    <html lang={locale} dir={LOCALE_DESCRIPTORS[locale].direction} suppressHydrationWarning>
      <head>
        {/*
         * Resolves the theme onto <html> before the first paint, so the page
         * never flashes the wrong palette and no component has to wait for
         * hydration to look right.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
