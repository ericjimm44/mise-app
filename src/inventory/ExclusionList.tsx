/**
 * Exclusions.
 *
 * An exclusion is a FILTER, not a preference — Rule 2 in the contract. The UI
 * has to carry that: no "avoid where possible", no soft language, no slider. The
 * copy states what the app will do, and the term list is visible because a
 * filter the user can't inspect is a filter they can't trust.
 *
 * Seafood ships on. That state comes from the seeded row in Dexie, not from any
 * condition in this file — the user can switch it off and it stays off.
 */

import { useMemo, useState } from 'react';
import type { Exclusion } from '@contract/types';
import { suggestRelatedTerms } from './relatedTerms';
import { Empty, PrimaryButton, QuietButton, RowButton, TextField, Toggle } from './ui';

export function ExclusionList({
  exclusions,
  onToggle,
  onAdd,
  onRemove,
}: {
  exclusions: readonly Exclusion[];
  onToggle: (id: string, enabled: boolean) => void;
  onAdd: (draft: { label: string; terms: readonly string[] }) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [rejected, setRejected] = useState<ReadonlySet<string>>(new Set());

  // Suggested related terms for whatever is being typed. "No mushrooms" should
  // also catch porcini, shiitake and truffle — a single literal string is a
  // filter with a hole in it.
  const suggested = useMemo(() => suggestRelatedTerms(label), [label]);
  const accepted = suggested.filter((t) => !rejected.has(t));

  const active = exclusions.filter((e) => e.enabled);

  function submit() {
    const clean = label.trim();
    if (!clean) return;
    onAdd({ label: clean, terms: accepted });
    setLabel('');
    setRejected(new Set());
  }

  return (
    <div>
      <p className="max-w-prose text-small text-ink-muted">
        These are filters, not preferences. Anything switched on will not appear in a recipe —
        not as an ingredient, not as a substitution, not as a garnish, not in a chef's note. A
        recipe that breaks one is thrown away and generated again rather than shown to you with
        a warning.
      </p>

      {active.length > 0 ? (
        <p className="mt-4 rounded bg-accent-wash px-4 py-3 text-small text-ink-soft">
          Currently filtering out{' '}
          <span className="text-ink">{active.map((e) => e.label).join(', ')}</span>.
        </p>
      ) : (
        <p className="mt-4 text-small text-ink-faint">Nothing is being filtered out.</p>
      )}

      <ul className="mt-6 divide-y divide-rule border-t border-rule">
        {exclusions.map((exclusion) => (
          <li key={exclusion.id} className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-body ${exclusion.enabled ? 'text-ink' : 'text-ink-muted'}`}>
                  {exclusion.label}
                  {exclusion.custom ? (
                    <span className="ml-2 text-micro uppercase tracking-wide text-ink-faint">
                      yours
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => (prev === exclusion.id ? null : exclusion.id))
                  }
                  className="mt-1 font-sans text-micro uppercase tracking-wide text-ink-faint hover:text-ink-soft"
                >
                  {exclusion.terms.length} terms
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {exclusion.custom ? (
                  <RowButton
                    label={`Delete ${exclusion.label}`}
                    onClick={() => onRemove(exclusion.id)}
                  >
                    Delete
                  </RowButton>
                ) : null}
                <Toggle
                  label={`Exclude ${exclusion.label}`}
                  tone="danger"
                  checked={exclusion.enabled}
                  onChange={(next) => onToggle(exclusion.id, next)}
                />
              </div>
            </div>

            {expanded === exclusion.id ? (
              <p className="mt-3 max-w-prose font-mono text-small leading-relaxed text-ink-muted">
                {exclusion.terms.join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {exclusions.length === 0 ? <Empty>Loading your exclusions…</Empty> : null}

      <form
        className="mt-8 border-t border-rule-strong pt-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h3 className="font-sans text-micro uppercase tracking-wide text-ink-faint">
          Exclude something else
        </h3>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <TextField
              label="Exclusion name"
              placeholder="Mushrooms, coriander, alcohol…"
              value={label}
              onChange={(next) => {
                setLabel(next);
                setRejected(new Set());
              }}
            />
          </div>
          <PrimaryButton type="submit" disabled={label.trim().length === 0}>
            Exclude
          </PrimaryButton>
        </div>

        {suggested.length > 0 ? (
          <div className="mt-5">
            <p className="text-small text-ink-muted">
              We'll also filter these. Tap one to drop it, or add your own — a name on its own
              rarely catches everything.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggested.map((term) => {
                const off = rejected.has(term);
                return (
                  <button
                    key={term}
                    type="button"
                    aria-pressed={!off}
                    onClick={() =>
                      setRejected((prev) => {
                        const next = new Set(prev);
                        if (next.has(term)) next.delete(term);
                        else next.add(term);
                        return next;
                      })
                    }
                    className={[
                      'rounded-full border px-3 py-1 font-sans text-small',
                      off
                        ? 'border-rule text-ink-faint line-through'
                        : 'border-rule-strong bg-paper-sunken text-ink-soft',
                    ].join(' ')}
                  >
                    {term}
                  </button>
                );
              })}
            </div>
            {accepted.length === 0 ? (
              <p className="mt-3 text-small text-danger">
                With every term dropped this would filter nothing. Keep at least one.
              </p>
            ) : null}
          </div>
        ) : null}

        {label.trim().length > 0 ? (
          <div className="mt-4">
            <QuietButton
              onClick={() => {
                setLabel('');
                setRejected(new Set());
              }}
            >
              Cancel
            </QuietButton>
          </div>
        ) : null}
      </form>
    </div>
  );
}
