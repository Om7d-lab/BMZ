'use client';

import { useCallback, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { DEFAULT_THEME, readTheme, setTheme, subscribeToTheme, type Theme } from '@/lib/theme';

/**
 * Reads the live theme. The subscription covers this tab, other tabs and the
 * system preference, so every toggle on the page agrees at all times.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => DEFAULT_THEME);
  return [theme, setTheme];
}

/**
 * The global theme toggle.
 *
 * A compact icon button, sized and styled like the rest of the header controls
 * — same radius, border, surface and focus ring — so it reads as part of the
 * interface rather than as an ornament. The glyph is the only thing that
 * changes, and it is driven entirely by `data-theme` on <html> (see the
 * `.theme-toggle__icon` rules in globals.css), so the server renders identical
 * markup for both themes and the inline theme script has the right glyph up
 * before the first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, applyTheme] = useTheme();
  const isDark = theme === 'dark';

  const toggle = useCallback(() => {
    applyTheme(isDark ? 'light' : 'dark');
  }, [applyTheme, isDark]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={clsx(
        'relative grid size-9 flex-none place-items-center overflow-hidden rounded-lg',
        'border border-line bg-surface text-ink-muted',
        'transition-colors hover:border-line-strong hover:bg-surface-raised hover:text-ink',
        className,
      )}
      // The state is resolved from the document on mount; the markup itself is
      // theme-agnostic, so only these ARIA attributes settle after hydration.
      suppressHydrationWarning
    >
      <Sun className="theme-toggle__icon theme-toggle__icon--sun size-4" aria-hidden />
      <Moon className="theme-toggle__icon theme-toggle__icon--moon size-4" aria-hidden />
    </button>
  );
}
