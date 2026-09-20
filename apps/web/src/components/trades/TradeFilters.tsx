'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Tag } from '@bmz/contracts';
import { Button, Input, Select } from '@/components/ui';

/**
 * The trade-list filter bar.
 *
 * State lives in the URL rather than in component state, so a filtered view is
 * a link: it survives a refresh, it can be bookmarked, and it is what a saved
 * filter will store when saved filters arrive.
 */
export function TradeFilters({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }

    // Any filter change invalidates the cursor into the previous result set.
    params.delete('cursor');
    router.push(`/trades?${params.toString()}`);
  }

  const hasFilters = ['search', 'status', 'direction', 'reviewStatus', 'tagIds', 'from', 'to'].some(
    (key) => searchParams.has(key),
  );

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ search: search.trim() || null });
      }}
    >
      <div className="w-56">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search symbol or notes"
          aria-label="Search trades"
        />
      </div>

      <div className="w-32">
        <Select
          aria-label="Status"
          defaultValue={searchParams.get('status') ?? ''}
          onChange={(event) => apply({ status: event.target.value || null })}
        >
          <option value="">Any status</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>

      <div className="w-32">
        <Select
          aria-label="Direction"
          defaultValue={searchParams.get('direction') ?? ''}
          onChange={(event) => apply({ direction: event.target.value || null })}
        >
          <option value="">Any side</option>
          <option value="LONG">Long</option>
          <option value="SHORT">Short</option>
        </Select>
      </div>

      <div className="w-36">
        <Select
          aria-label="Review status"
          defaultValue={searchParams.get('reviewStatus') ?? ''}
          onChange={(event) => apply({ reviewStatus: event.target.value || null })}
        >
          <option value="">Any review</option>
          <option value="UNREVIEWED">Unreviewed</option>
          <option value="NEEDS_REVIEW">Needs review</option>
          <option value="REVIEWED">Reviewed</option>
        </Select>
      </div>

      <div className="w-44">
        <Select
          aria-label="Tag"
          defaultValue={searchParams.get('tagIds') ?? ''}
          onChange={(event) => apply({ tagIds: event.target.value || null })}
        >
          <option value="">Any tag</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" variant="secondary" size="sm">
        Apply
      </Button>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            router.push('/trades');
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
