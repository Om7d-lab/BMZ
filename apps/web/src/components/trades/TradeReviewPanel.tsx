'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import type { ReviewStatus, Trade } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Card, CardHeader, Field, Select, Spinner, Textarea } from '@/components/ui';

/**
 * The review a trader writes after the fact.
 *
 * Rating is execution quality, kept deliberately separate from the result: a
 * trade that lost money while following the plan is a 5, and a lucky win that
 * broke every rule is a 1. Conflating the two is what makes a journal lie.
 */
export function TradeReviewPanel({
  tradeId,
  organizationId,
  initialNotes,
  initialRating,
  initialReviewStatus,
}: {
  tradeId: string;
  organizationId: string | null;
  initialNotes: string;
  initialRating: number | null;
  initialReviewStatus: ReviewStatus;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(initialReviewStatus);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState('saving');
    setError(null);

    try {
      await apiRequest<Trade>(`/trades/${tradeId}`, {
        method: 'PATCH',
        organizationId,
        body: { notes: notes.trim() || null, rating, reviewStatus },
      });

      setState('saved');
      router.refresh();
    } catch (cause) {
      setState('error');
      setError(cause instanceof ApiRequestError ? cause.message : 'Could not save. Try again.');
    }
  }

  return (
    <Card>
      <CardHeader title="Review" description="Rate how you executed, not how it turned out." />

      <div className="space-y-4">
        <Field label="Execution rating">
          <div className="flex gap-1.5" role="group" aria-label="Execution rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={rating === value}
                onClick={() => setRating(rating === value ? null : value)}
                className={clsx(
                  'numeric size-9 rounded-lg border text-sm transition-colors',
                  rating === value
                    ? 'border-brand bg-brand-soft font-semibold text-brand'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Status">
          <Select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value as ReviewStatus)}
          >
            <option value="UNREVIEWED">Unreviewed</option>
            <option value="NEEDS_REVIEW">Needs review</option>
            <option value="REVIEWED">Reviewed</option>
          </Select>
        </Field>

        <Field label="Notes">
          <Textarea
            rows={7}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What was the setup? What did you do well, and what would you change?"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-xs text-loss">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={state === 'saving'} size="sm">
            {state === 'saving' ? <Spinner /> : null}
            {state === 'saving' ? 'Saving' : 'Save review'}
          </Button>
          {state === 'saved' ? <span className="text-xs text-profit">Saved</span> : null}
        </div>
      </div>
    </Card>
  );
}
