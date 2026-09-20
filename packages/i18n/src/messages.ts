import { DEFAULT_LOCALE, LOCALE_DESCRIPTORS, type Locale } from './locales.js';

/**
 * The English catalogue is the contract. Every other locale is typed as
 * `Partial<Messages>`, and `translate` falls back key by key, so a partly
 * translated locale degrades to English per string rather than per page.
 *
 * Stage one ships English only; the remaining catalogues are added in the
 * localisation stage against this same shape.
 */
export const en = {
  'app.name': 'BMZ Trade Lab',
  'app.tagline': 'Trade with evidence, not memory.',

  'nav.dashboard': 'Dashboard',
  'nav.trades': 'Trades',
  'nav.journal': 'Journal',
  'nav.notebook': 'Notebook',
  'nav.playbooks': 'Playbooks',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',

  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.signUp': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Name',
  'auth.forgotPassword': 'Forgot your password?',
  'auth.noAccount': 'No account yet?',
  'auth.haveAccount': 'Already have an account?',

  'metric.netPnl': 'Net P&L',
  'metric.grossPnl': 'Gross P&L',
  'metric.winRate': 'Win rate',
  'metric.profitFactor': 'Profit factor',
  'metric.expectancy': 'Expectancy',
  'metric.averageR': 'Average R',
  'metric.maxDrawdown': 'Max drawdown',
  'metric.tradeCount': 'Trades',
  'metric.averageWin': 'Average win',
  'metric.averageLoss': 'Average loss',
  'metric.fees': 'Fees',
  'metric.currentStreak': 'Current streak',

  'trade.symbol': 'Symbol',
  'trade.direction': 'Direction',
  'trade.long': 'Long',
  'trade.short': 'Short',
  'trade.status': 'Status',
  'trade.open': 'Open',
  'trade.closed': 'Closed',
  'trade.opened': 'Opened',
  'trade.entry': 'Entry',
  'trade.exit': 'Exit',
  'trade.quantity': 'Quantity',
  'trade.stopLoss': 'Stop',
  'trade.takeProfit': 'Target',
  'trade.rMultiple': 'R',
  'trade.duration': 'Duration',
  'trade.tags': 'Tags',
  'trade.notes': 'Notes',
  'trade.rating': 'Execution rating',
  'trade.executions': 'Executions',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.loading': 'Loading',
  'common.empty': 'Nothing here yet',
  'common.retry': 'Try again',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

/** Catalogues for the remaining locales are filled in during localisation. */
const catalogues: Readonly<Record<Locale, Partial<Messages>>> = {
  en,
  fa: {},
  ar: {},
  es: {},
  pt: {},
  'zh-CN': {},
  ja: {},
  tr: {},
};

export function getCatalogue(locale: Locale): Messages {
  return { ...en, ...catalogues[locale] };
}

/**
 * Looks up a key and substitutes `{name}` placeholders. Unknown placeholders
 * are left in place rather than blanked, so a missing value is visible in
 * review instead of silently dropping a number from a sentence.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  values?: Readonly<Record<string, string | number>>,
): string {
  const template = catalogues[locale]?.[key] ?? en[key];
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** The share of keys translated for a locale, for a coverage report. */
export function translationCoverage(locale: Locale): number {
  if (locale === DEFAULT_LOCALE) return 1;
  const total = Object.keys(en).length;
  const translated = Object.keys(catalogues[locale] ?? {}).length;
  return total === 0 ? 1 : translated / total;
}

export function localeTag(locale: Locale): string {
  return LOCALE_DESCRIPTORS[locale].intlTag;
}
