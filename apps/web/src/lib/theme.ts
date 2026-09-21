/**
 * The theme system.
 *
 * There is exactly one source of truth: the `data-theme` attribute on <html>.
 * The CSS in globals.css keys every token off it, so switching the attribute
 * re-themes the whole app without a single component knowing a theme exists.
 *
 * Precedence is: an explicit choice in localStorage, otherwise the operating
 * system preference, which stays live until the visitor picks a side.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bmz-theme';

/** Fired on the window when the theme changes, so every toggle stays in sync. */
export const THEME_EVENT = 'bmz:themechange';

/** The product is dark by default; this is also the no-JavaScript fallback. */
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Runs in <head> before the first paint, so the correct theme is already on
 * <html> by the time anything renders. Kept dependency-free and tiny because it
 * is inlined into every document.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'${DEFAULT_THEME}');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`;

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The theme currently applied to the document. */
export function readTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const applied = document.documentElement.dataset.theme;
  return isTheme(applied) ? applied : DEFAULT_THEME;
}

/** The explicit choice, if one has been made. */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    // Private mode, or storage disabled. The session simply won't persist.
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
}

/**
 * Applies a theme to the document, crossfading the colour change.
 *
 * The transition class is added only for the length of the swap so it never
 * slows down an ordinary hover or focus change.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (readTheme() === theme) return;

  root.classList.add('theme-transition');
  root.dataset.theme = theme;

  window.setTimeout(() => root.classList.remove('theme-transition'), 300);
}

/** Records an explicit choice and applies it. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice shouldn't stop us honouring it now.
  }

  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT));
}

/**
 * Subscribes to every way the theme can change: this tab, another tab, or the
 * operating system while no explicit choice has been made.
 */
export function subscribeToTheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: light)');

  const onSystemChange = () => {
    // An explicit choice outranks the system, so only follow it while there
    // isn't one.
    if (readStoredTheme()) return;
    applyTheme(systemTheme());
    onChange();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(isTheme(event.newValue) ? event.newValue : systemTheme());
    onChange();
  };

  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', onSystemChange);

  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', onSystemChange);
  };
}
