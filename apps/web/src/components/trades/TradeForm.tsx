'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Account, ExecutionSide, InstrumentClass, Tag, Trade } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui';

interface ExecutionDraft {
  key: string;
  side: ExecutionSide;
  quantity: string;
  price: string;
  fees: string;
  executedAt: string;
}

const INSTRUMENT_CLASSES: Array<{ value: InstrumentClass; label: string }> = [
  { value: 'STOCK', label: 'Stock' },
  { value: 'FUTURES', label: 'Futures' },
  { value: 'FOREX', label: 'Forex' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'OPTION', label: 'Option' },
];

function blankExecution(side: ExecutionSide): ExecutionDraft {
  return {
    key: Math.random().toString(36).slice(2),
    side,
    quantity: '',
    price: '',
    fees: '0',
    // `datetime-local` wants a local-time string with no zone suffix.
    executedAt: new Date().toISOString().slice(0, 16),
  };
}

/**
 * Manual trade entry.
 *
 * The form collects executions, not a result. P&L, average prices, the
 * R-multiple and the holding period are all derived server-side from the fills,
 * so there is no field here in which a trader can record a number that
 * disagrees with their own executions.
 */
export function TradeForm({
  accounts,
  tags,
  organizationId,
}: {
  accounts: Account[];
  tags: Tag[];
  organizationId: string | null;
}) {
  const router = useRouter();

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [symbol, setSymbol] = useState('');
  const [instrumentClass, setInstrumentClass] = useState<InstrumentClass>('STOCK');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [executions, setExecutions] = useState<ExecutionDraft[]>([
    blankExecution('BUY'),
    blankExecution('SELL'),
  ]);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function updateExecution(key: string, changes: Partial<ExecutionDraft>) {
    setExecutions((current) =>
      current.map((execution) =>
        execution.key === key ? { ...execution, ...changes } : execution,
      ),
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      const trade = await apiRequest<Trade>('/trades', {
        method: 'POST',
        organizationId,
        body: {
          accountId,
          symbol: symbol.trim(),
          instrumentClass,
          stopLoss: stopLoss.trim() || null,
          takeProfit: takeProfit.trim() || null,
          notes: notes.trim() || null,
          tagIds: selectedTags,
          executions: executions.map((execution) => ({
            side: execution.side,
            quantity: execution.quantity.trim(),
            price: execution.price.trim(),
            fees: execution.fees.trim() || '0',
            // The input gives local wall-clock time; send it as a real instant.
            executedAt: new Date(execution.executedAt).toISOString(),
          })),
        },
      });

      router.push(`/trades/${trade.id}`);
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        setError(cause.message);
        setFieldErrors(cause.details ?? {});
      } else {
        setError('Could not reach the server. Try again.');
      }
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          You need a trading account before you can record a trade. Add one in settings.
        </p>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Card>
        <CardHeader title="The position" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Account">
            <Select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Symbol" error={fieldErrors.symbol?.[0]}>
            <Input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              placeholder="MESZ5"
              required
              maxLength={40}
            />
          </Field>

          <Field label="Instrument">
            <Select
              value={instrumentClass}
              onChange={(event) => setInstrumentClass(event.target.value as InstrumentClass)}
            >
              {INSTRUMENT_CLASSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop" hint="Sets your R" error={fieldErrors.stopLoss?.[0]}>
              <Input
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
                inputMode="decimal"
                placeholder="6030"
              />
            </Field>
            <Field label="Target">
              <Input
                value={takeProfit}
                onChange={(event) => setTakeProfit(event.target.value)}
                inputMode="decimal"
                placeholder="6070"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Executions"
          description="Enter the fills as they happened. Everything else is worked out from them."
          action={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setExecutions((current) => [...current, blankExecution('BUY')])}
              >
                Add buy
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setExecutions((current) => [...current, blankExecution('SELL')])}
              >
                Add sell
              </Button>
            </div>
          }
        />

        <div className="space-y-3">
          {executions.map((execution, index) => (
            <div
              key={execution.key}
              className="grid gap-3 rounded-lg border border-line bg-surface-raised/40 p-3 sm:grid-cols-[110px_1fr_1fr_1fr_minmax(0,1.4fr)_auto]"
            >
              <Field label="Side">
                <Select
                  value={execution.side}
                  onChange={(event) =>
                    updateExecution(execution.key, { side: event.target.value as ExecutionSide })
                  }
                >
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </Select>
              </Field>

              <Field label="Quantity" error={fieldErrors[`executions.${index}.quantity`]?.[0]}>
                <Input
                  value={execution.quantity}
                  onChange={(event) =>
                    updateExecution(execution.key, { quantity: event.target.value })
                  }
                  inputMode="decimal"
                  required
                  placeholder="3"
                />
              </Field>

              <Field label="Price" error={fieldErrors[`executions.${index}.price`]?.[0]}>
                <Input
                  value={execution.price}
                  onChange={(event) =>
                    updateExecution(execution.key, { price: event.target.value })
                  }
                  inputMode="decimal"
                  required
                  placeholder="6040"
                />
              </Field>

              <Field label="Fees">
                <Input
                  value={execution.fees}
                  onChange={(event) => updateExecution(execution.key, { fees: event.target.value })}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              <Field label="Filled at">
                <Input
                  type="datetime-local"
                  value={execution.executedAt}
                  onChange={(event) =>
                    updateExecution(execution.key, { executedAt: event.target.value })
                  }
                  required
                />
              </Field>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  // A trade needs at least one fill, so the last row cannot go.
                  disabled={executions.length <= 1}
                  onClick={() =>
                    setExecutions((current) => current.filter((row) => row.key !== execution.key))
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        {fieldErrors.executions?.[0] ? (
          <p role="alert" className="mt-3 text-xs text-loss">
            {fieldErrors.executions[0]}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Context"
          description="Optional, but this is what makes the reports worth reading."
        />

        <div className="space-y-4">
          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setSelectedTags((current) =>
                        isSelected ? current.filter((id) => id !== tag.id) : [...current, tag.id],
                      )
                    }
                  >
                    <Badge
                      tone={
                        isSelected ? (tag.category === 'MISTAKE' ? 'loss' : 'brand') : 'neutral'
                      }
                    >
                      {tag.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Notes">
            <Textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Why did you take it?"
            />
          </Field>
        </div>
      </Card>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {pending ? 'Saving' : 'Save trade'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
