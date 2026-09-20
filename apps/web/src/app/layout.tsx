import type { Metadata, Viewport } from 'next';
import { DEFAULT_LOCALE, LOCALE_DESCRIPTORS } from '@bmz/i18n';
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
  themeColor: '#0c1118',
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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
