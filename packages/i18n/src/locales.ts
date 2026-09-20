/**
 * The locale registry.
 *
 * English is the source language: every catalogue is typed against the English
 * one, so adding a key without translating it is a type error rather than a
 * blank string in production. Direction lives here rather than in the web app
 * because the API also needs it — PDF exports and emails are laid out server
 * side.
 */

export const LOCALES = ['en', 'fa', 'ar', 'es', 'pt', 'zh-CN', 'ja', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export type TextDirection = 'ltr' | 'rtl';

export interface LocaleDescriptor {
  code: Locale;
  /** The language's name in that language, which is what a picker should show. */
  nativeName: string;
  englishName: string;
  direction: TextDirection;
  /** BCP-47 tag handed to Intl for dates, numbers and currency. */
  intlTag: string;
}

export const LOCALE_DESCRIPTORS: Readonly<Record<Locale, LocaleDescriptor>> = {
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    direction: 'ltr',
    intlTag: 'en-US',
  },
  fa: {
    code: 'fa',
    nativeName: 'فارسی',
    englishName: 'Persian',
    direction: 'rtl',
    intlTag: 'fa-IR',
  },
  ar: { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', direction: 'rtl', intlTag: 'ar' },
  es: {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    direction: 'ltr',
    intlTag: 'es',
  },
  pt: {
    code: 'pt',
    nativeName: 'Português',
    englishName: 'Portuguese',
    direction: 'ltr',
    intlTag: 'pt-BR',
  },
  'zh-CN': {
    code: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Simplified Chinese',
    direction: 'ltr',
    intlTag: 'zh-Hans-CN',
  },
  ja: {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    direction: 'ltr',
    intlTag: 'ja-JP',
  },
  tr: {
    code: 'tr',
    nativeName: 'Türkçe',
    englishName: 'Turkish',
    direction: 'ltr',
    intlTag: 'tr-TR',
  },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): TextDirection {
  return LOCALE_DESCRIPTORS[locale].direction;
}

export function isRtl(locale: Locale): boolean {
  return directionOf(locale) === 'rtl';
}

/**
 * Picks the best supported locale from an Accept-Language header, falling back
 * to English. Matches the exact tag first, then the base language, so
 * `zh-CN,zh;q=0.9` resolves to `zh-CN` and `pt-PT` resolves to `pt`.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const candidates = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='))
        ?.slice(2);
      return { tag: tag.trim(), quality: quality ? Number(quality) : 1 };
    })
    .filter((candidate) => candidate.tag.length > 0 && Number.isFinite(candidate.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of candidates) {
    if (isLocale(tag)) return tag;

    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;

    const base = tag.split('-')[0]?.toLowerCase();
    if (base) {
      const match = LOCALES.find((locale) => locale.split('-')[0]?.toLowerCase() === base);
      if (match) return match;
    }
  }

  return DEFAULT_LOCALE;
}
