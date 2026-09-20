'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Account, AccountType } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Select, Spinner } from '@/components/ui';

const TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'LIVE', label: 'Live' },
  { value: 'PAPER', label: 'Paper' },
  { value: 'PROP_EVALUATION', label: 'Prop evaluation' },
  { value: 'PROP_FUNDED', label: 'Prop funded' },
  { value: 'BACKTEST', label: 'Backtest' },
];

export function AccountForm({
  organizationId,
  defaultTimezone,
}: {
  organizationId: string | null;
  defaultTimezone: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const element = event.currentTarget;

    try {
      await apiRequest<Account>('/accounts', {
        method: 'POST',
        organizationId,
        body: {
          name: String(form.get('name') ?? ''),
          type: String(form.get('type') ?? 'LIVE'),
          broker: String(form.get('broker') ?? '') || null,
          currency: String(form.get('currency') ?? 'USD'),
          startingBalance: String(form.get('startingBalance') ?? '0') || '0',
          timezone: String(form.get('timezone') ?? defaultTimezone),
        },
      });

      element.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Could not save. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" required maxLength={80} placeholder="Futures account" />
        </Field>

        <Field label="Type">
          <Select name="type" defaultValue="LIVE">
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Broker" hint="Optional">
          <Input name="broker" maxLength={80} placeholder="Who you trade through" />
        </Field>

        <Field label="Currency">
          <Input name="currency" defaultValue="USD" maxLength={3} required />
        </Field>

        <Field label="Starting balance">
          <Input name="startingBalance" defaultValue="0" inputMode="decimal" />
        </Field>

        <Field label="Timezone" hint="Cannot change once the account has trades">
          <Input name="timezone" defaultValue={defaultTimezone} required />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-loss">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? <Spinner /> : null}
        {pending ? 'Adding' : 'Add account'}
      </Button>
    </form>
  );
}
