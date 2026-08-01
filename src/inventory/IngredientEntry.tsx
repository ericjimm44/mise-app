/**
 * Manual ingredient entry with search-as-you-type, and the confirmation tray
 * every source funnels through.
 *
 * The component knows about `IngredientSource` and `IngredientCandidate`. It
 * does NOT know that a human typed these — when photo capture lands, it hands
 * candidates to the same tray and this file changes by one entry in a list of
 * sources.
 */

import { useMemo, useRef, useState } from 'react';
import { containsTerm } from '@contract/recipe.schema';
import type { Exclusion } from '@contract/types';
import { searchCatalog } from './catalog';
import {
  candidatesToDrafts,
  manualIngredientSource,
  type IngredientCandidate,
} from './sources';
import type { InventoryDraft } from './storage';
import { Empty, PrimaryButton, QuietButton, TextField } from './ui';

function activeExclusionFor(
  name: string,
  exclusions: readonly Exclusion[],
): Exclusion | undefined {
  return exclusions.find(
    (e) => e.enabled && e.terms.some((term) => containsTerm(name, term)),
  );
}

export function IngredientEntry({
  exclusions,
  onConfirm,
}: {
  exclusions: readonly Exclusion[];
  onConfirm: (drafts: readonly InventoryDraft[]) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<readonly IngredientCandidate[]>([]);
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => searchCatalog(query), [query]);
  const staged = candidates.filter((c) => !dropped.has(c.key));

  async function propose(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const produced = await manualIngredientSource.propose(trimmed);
    setCandidates((prev) => {
      const seen = new Set(prev.map((c) => c.name.toLowerCase()));
      const fresh = produced
        .filter((c) => !seen.has(c.name.toLowerCase()))
        // Keys are only unique within one proposal round; make them unique
        // across rounds so the tray can key a list on them.
        .map((c, i) => ({ ...c, key: `${c.key}:${prev.length + i}` }));
      return [...prev, ...fresh];
    });
    setQuery('');
    inputRef.current?.focus();
  }

  function toggleDropped(key: string) {
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function confirm() {
    if (staged.length === 0) return;
    await onConfirm(candidatesToDrafts(staged));
    setCandidates([]);
    setDropped(new Set());
  }

  return (
    <div>
      <TextField
        label="Add an ingredient"
        placeholder="Type what you have — 2 chicken thighs, half a lemon…"
        value={query}
        onChange={setQuery}
        inputRef={inputRef}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void propose(query);
          }
        }}
      />

      <p className="mt-2 text-micro uppercase tracking-wide text-ink-faint">
        Commas and “and” separate items. Nothing is stored until you confirm.
      </p>

      {query.trim() && suggestions.length > 0 ? (
        <ul className="mt-4 divide-y divide-rule border-t border-rule">
          {suggestions.map((s) => (
            <li key={s.normalized}>
              <button
                type="button"
                onClick={() => void propose(s.name)}
                className="flex min-h-tap w-full items-baseline justify-between py-1 text-left"
              >
                <span className="text-body text-ink">{s.name}</span>
                <span className="text-micro uppercase tracking-wide text-ink-faint">
                  {s.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-8 border-t border-rule-strong pt-6">
          <h3 className="font-sans text-micro uppercase tracking-wide text-ink-faint">
            Confirm before adding
          </h3>

          {staged.length === 0 ? (
            <Empty>Nothing left to add — everything here has been dismissed.</Empty>
          ) : (
            <ul className="mt-4 divide-y divide-rule border-t border-rule">
              {candidates.map((candidate) => {
                const isDropped = dropped.has(candidate.key);
                const excluded = activeExclusionFor(candidate.name, exclusions);
                return (
                  <li
                    key={candidate.key}
                    className={`flex items-start justify-between gap-4 py-3 ${
                      isDropped ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-body text-ink">
                        {candidate.quantity ? (
                          <span className="tnum mr-2 font-mono text-small text-ink-muted">
                            {candidate.quantity}
                          </span>
                        ) : null}
                        {candidate.name}
                      </p>
                      <p className="mt-1 text-micro uppercase tracking-wide text-ink-faint">
                        {candidate.category ?? 'uncategorised'}
                      </p>
                      {excluded ? (
                        <p className="mt-2 text-small text-danger">
                          {excluded.label} is excluded, so this will be stored but never used
                          in a recipe.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={isDropped ? `Keep ${candidate.name}` : `Dismiss ${candidate.name}`}
                      onClick={() => toggleDropped(candidate.key)}
                      className="min-h-tap shrink-0 font-sans text-small text-ink-faint hover:text-ink-soft"
                    >
                      {isDropped ? 'Keep' : 'Dismiss'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 flex items-center gap-3">
            <PrimaryButton onClick={() => void confirm()} disabled={staged.length === 0}>
              {staged.length === 1 ? 'Add 1 item' : `Add ${staged.length} items`}
            </PrimaryButton>
            <QuietButton
              onClick={() => {
                setCandidates([]);
                setDropped(new Set());
              }}
            >
              Discard
            </QuietButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
