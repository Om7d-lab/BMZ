'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  CandlestickChart,
  ClipboardList,
  LayoutDashboard,
  NotebookPen,
  Settings,
} from 'lucide-react';
import { BmzMark } from '@/components/ui/brand';
import {
  Sidebar as SidebarRoot,
  SidebarBody,
  SidebarLabel,
  SidebarLink,
} from '@/components/ui/sidebar';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Shown but not linked until the stage that builds it ships. */
  comingSoon?: boolean;
}

const ICON = 'size-4.5';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={ICON} /> },
  { href: '/trades', label: 'Trades', icon: <CandlestickChart className={ICON} /> },
  { href: '/journal', label: 'Journal', icon: <BookOpen className={ICON} />, comingSoon: true },
  {
    href: '/notebook',
    label: 'Notebook',
    icon: <NotebookPen className={ICON} />,
    comingSoon: true,
  },
  {
    href: '/playbooks',
    label: 'Playbooks',
    icon: <ClipboardList className={ICON} />,
    comingSoon: true,
  },
  { href: '/reports', label: 'Reports', icon: <BarChart3 className={ICON} />, comingSoon: true },
];

export function Sidebar({
  accountCount,
  workspaceName,
}: {
  accountCount: number;
  workspaceName: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarRoot>
      <SidebarBody>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-2.5 py-1 text-base"
          aria-label="BMZ Trade Lab — dashboard"
        >
          <BmzMark className="size-7 shrink-0" />
          <SidebarLabel className="font-semibold tracking-tight text-ink">
            BMZ Trade Lab
          </SidebarLabel>
        </Link>

        <nav className="flex flex-col gap-1" aria-label="Sections">
          {NAV.map((item) => {
            // Sections that arrive in a later stage are shown but not linked, so
            // the shape of the product is visible without offering a dead end.
            if (item.comingSoon) {
              return (
                <span
                  key={item.href}
                  title="Arriving in a later release"
                  className="flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-subtle/70"
                >
                  <span className="grid size-5 shrink-0 place-items-center">{item.icon}</span>
                  <SidebarLabel className="flex-1">{item.label}</SidebarLabel>
                  <SidebarLabel className="text-[10px] uppercase tracking-wide text-ink-subtle/60">
                    Soon
                  </SidebarLabel>
                </span>
              );
            }

            return (
              <SidebarLink
                key={item.href}
                link={item}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <SidebarLink
            link={{ href: '/settings', label: 'Settings', icon: <Settings className={ICON} /> }}
            active={pathname === '/settings' || pathname.startsWith('/settings/')}
          />

          <SidebarLabel className="px-2.5 text-[11px] leading-relaxed text-ink-subtle">
            {accountCount} {accountCount === 1 ? 'account' : 'accounts'} in {workspaceName}
          </SidebarLabel>
        </div>
      </SidebarBody>
    </SidebarRoot>
  );
}
