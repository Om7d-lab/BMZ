'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

interface NavItem {
  href: string;
  label: string;
  /** Shown but not linked until the stage that builds it ships. */
  comingSoon?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trades', label: 'Trades' },
  { href: '/journal', label: 'Journal', comingSoon: true },
  { href: '/notebook', label: 'Notebook', comingSoon: true },
  { href: '/playbooks', label: 'Playbooks', comingSoon: true },
  { href: '/reports', label: 'Reports', comingSoon: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        // Sections that arrive in a later stage are shown but not linked, so
        // the shape of the product is visible without offering a dead end.
        if (item.comingSoon) {
          return (
            <span
              key={item.href}
              className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-subtle/70"
              title="Arriving in a later release"
            >
              {item.label}
              <span className="text-[10px] uppercase tracking-wide text-ink-subtle/60">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={clsx(
              'rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-brand-soft font-medium text-brand'
                : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
