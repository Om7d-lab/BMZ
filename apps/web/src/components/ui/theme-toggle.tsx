'use client';

import { useCallback, useSyncExternalStore } from 'react';
import clsx from 'clsx';
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
 * The global theme toggle: a small illustrated sky that trades a sun for a moon.
 *
 * The visuals are entirely CSS, driven by `data-theme` on <html> (see the
 * `.theme-toggle` block in globals.css). React only supplies the click handler
 * and the accessible state, which means the server renders identical markup for
 * both themes and the inline theme script has the control in its final position
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
      className={clsx('theme-toggle', className)}
      // The state is resolved from the document on mount; the markup itself is
      // theme-agnostic, so only these ARIA attributes settle after hydration.
      suppressHydrationWarning
    >
      <span className="theme-toggle__rings" aria-hidden />
      <span className="theme-toggle__clouds" aria-hidden />

      {/* The dimmed option, sitting on the far side. */}
      <span className="theme-toggle__disc theme-toggle__disc--ghost" aria-hidden>
        <span className="theme-toggle__face theme-toggle__face--sun" />
        <span className="theme-toggle__face theme-toggle__face--moon" />
      </span>

      {/* The raised disc that slides between the two sides. */}
      <span className="theme-toggle__disc theme-toggle__disc--knob" aria-hidden>
        <span className="theme-toggle__face theme-toggle__face--sun" />
        <span className="theme-toggle__face theme-toggle__face--moon" />
      </span>
    </button>
  );
}
