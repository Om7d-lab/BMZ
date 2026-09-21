'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Account, UserProfile } from '@bmz/contracts';
import { apiRequest } from '@/lib/api';
import { Button, Select } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function TopBar({
  user,
  accounts,
  activeAccountId,
  title,
}: {
  user: UserProfile;
  accounts: Account[];
  activeAccountId: string | null;
  title: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      // Even a failed sign-out should land the trader on the sign-in screen
      // rather than leaving them staring at a page they think is private.
      router.replace('/login');
      router.refresh();
    }
  }

  function switchAccount(accountId: string) {
    const params = new URLSearchParams(window.location.search);
    if (accountId) params.set('account', accountId);
    else params.delete('account');

    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
      <h1 className="text-base font-semibold tracking-tight text-ink">{title}</h1>

      <div className="flex items-center gap-3">
        {accounts.length > 0 ? (
          <div className="w-52">
            <Select
              aria-label="Trading account"
              value={activeAccountId ?? ''}
              onChange={(event) => switchAccount(event.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="hidden text-end sm:block">
          <p className="text-xs font-medium text-ink">{user.displayName}</p>
          <p className="text-[11px] text-ink-subtle">{user.timezone}</p>
        </div>

        <ThemeToggle />

        <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
          {signingOut ? 'Signing out' : 'Sign out'}
        </Button>
      </div>
    </header>
  );
}
