/**
 * Pantry staples — the one-time setup.
 *
 * These are items the generator may use without it counting as a shopping trip,
 * so an over-generous list is not a convenience, it is a lie the validator can't
 * catch: the recipe passes Rule 1 because the staple looks available, and then
 * the cupboard is empty. Almost everything ships off. Switching one on is a
 * claim the user is making about their own kitchen.
 */

import { useState } from 'react';
import type { Exclusion, PantryStaple } from '@contract/types';
import { STAPLE_GROUP_ORDER, stapleGroup, type StapleGroup } from './defaults';
import { stapleViolatesExclusions } from './storage';
import { GroupLabel, PrimaryButton, RowButton, TextField, Toggle } from './ui';

const GROUP_LABEL: Readonly<Record<StapleGroup, string>> = {
  seasoning: 'Seasoning',
  fat: 'Fats & oils',
  acid: 'Vinegars',
  pantry: 'Pantry',
  'dried spice': 'Dried spices',
};

export function PantryStaples({
  staples,
  exclusions,
  onToggle,
  onAdd,
  onRemove,
}: {
  staples: readonly PantryStaple[];
  exclusions: readonly Exclusion[];
  onToggle: (id: string, enabled: boolean) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const grouped = new Map<StapleGroup, PantryStaple[]>();
  for (const staple of staples) {
    const group = stapleGroup(staple.id);
    const bucket = grouped.get(group);
    if (bucket) bucket.push(staple);
    else grouped.set(group, [staple]);
  }

  const enabledCount = staples.filter((s) => s.enabled).length;

  function submit() {
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft('');
  }

  return (
    <div>
      <p className="text-small text-ink-muted">
        {enabledCount} of {staples.length} switched on. Only switch on what is genuinely in the
        cupboard right now — the generator treats these as always available and will build a
        recipe around one.
      </p>

      {STAPLE_GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => (
        <div key={group}>
          <GroupLabel>{GROUP_LABEL[group]}</GroupLabel>
          <ul className="mt-2 divide-y divide-rule border-t border-rule">
            {(grouped.get(group) ?? []).map((staple) => {
              const blocked = stapleViolatesExclusions(staple, exclusions);
              return (
                <li key={staple.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className={`text-body ${staple.enabled ? 'text-ink' : 'text-ink-muted'}`}>
                      {staple.name}
                    </p>
                    {blocked ? (
                      <p className="mt-1 text-small text-danger">
                        Blocked by the {blocked.label} exclusion.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Only user-added staples are removable; seeded ones toggle off. */}
                    {staple.id.startsWith('staple_') ? (
                      <RowButton label={`Remove ${staple.name}`} onClick={() => onRemove(staple.id)}>
                        Remove
                      </RowButton>
                    ) : null}
                    <Toggle
                      label={`${staple.name} always available`}
                      checked={staple.enabled}
                      disabled={blocked !== null}
                      onChange={(next) => onToggle(staple.id, next)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <form
        className="mt-8 flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex-1">
          <TextField
            label="Add a pantry staple"
            placeholder="Something else you always have…"
            value={draft}
            onChange={setDraft}
          />
        </div>
        <PrimaryButton type="submit" disabled={draft.trim().length === 0}>
          Add
        </PrimaryButton>
      </form>
    </div>
  );
}
