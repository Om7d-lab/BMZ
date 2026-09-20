'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LOCALE_DESCRIPTORS, LOCALES } from '@bmz/i18n';
import type { UserProfile } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Select, Spinner } from '@/components/ui';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'AED', 'TRY', 'BRL'] as const;

export function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [timezone, setTimezone] = useState(user.timezone);
  const [locale, setLocale] = useState(user.locale);
  const [currency, setCurrency] = useState(user.preferredCurrency);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  // The browser knows every zone the runtime supports; no list to maintain.
  const timezones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [user.timezone];

  async function save() {
    setState('saving');
    setError(null);

    try {
      await apiRequest<UserProfile>('/auth/profile', {
        method: 'PATCH',
        body: { displayName, timezone, locale, preferredCurrency: currency },
      });
      setState('saved');
      router.refresh();
    } catch (cause) {
      setState('idle');
      setError(cause instanceof ApiRequestError ? cause.message : 'Could not save. Try again.');
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </Field>

      <Field label="Email">
        <Input value={user.email} disabled readOnly />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone" hint="Sets your trading day boundary">
          <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Currency">
          <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Language"
        hint="English today. The other languages fill in as their catalogues are translated."
      >
        <Select value={locale} onChange={(event) => setLocale(event.target.value)}>
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_DESCRIPTORS[code].nativeName} ({LOCALE_DESCRIPTORS[code].englishName})
            </option>
          ))}
        </Select>
      </Field>

      {error ? (
        <p role="alert" className="text-xs text-loss">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={state === 'saving'} size="sm">
          {state === 'saving' ? <Spinner /> : null}
          {state === 'saving' ? 'Saving' : 'Save profile'}
        </Button>
        {state === 'saved' ? <span className="text-xs text-profit">Saved</span> : null}
      </div>
    </div>
  );
}
