/**
 * The post-cook form.
 *
 * Filled in by someone who has just cooked and eaten and would like to put
 * their phone down, so every field is pre-filled with the recipe's own claim
 * and the whole thing can be submitted untouched. Correcting an estimate is one
 * tap; agreeing with it is none.
 *
 * Nothing here writes to the saved recipe. That is the point of the table
 * split: what the recipe said is a snapshot, what actually happened is a log.
 */

import { useState, type FormEvent } from 'react';
import type { CookLog, DifficultyStars, SavedRecipe, TechniqueId } from '@contract/types';
import { getTechnique } from '@contract/techniques';
import { techniquesInRecipe } from './progression';
import { logCook } from './storage';

const STARS: readonly DifficultyStars[] = [1, 2, 3, 4, 5];

export function CookLogForm({
  saved,
  onLogged,
  onCancel,
}: {
  saved: SavedRecipe;
  onLogged?: (log: CookLog) => void;
  onCancel?: () => void;
}) {
  const offered = techniquesInRecipe(saved.recipe);

  const [wouldMakeAgain, setWouldMakeAgain] = useState(true);
  const [actualDifficulty, setActualDifficulty] = useState<DifficultyStars>(
    saved.recipe.difficulty.stars,
  );
  const [activeMinutes, setActiveMinutes] = useState(String(saved.recipe.time.active_minutes));
  const [performed, setPerformed] = useState<readonly TechniqueId[]>(offered);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleTechnique(id: TechniqueId) {
    setPerformed((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const log = await logCook({
        savedRecipeId: saved.id,
        wouldMakeAgain,
        actualDifficulty,
        actualActiveMinutes: Math.max(0, Number(activeMinutes) || 0),
        techniquesPerformed: performed,
        ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
      });
      onLogged?.(log);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-rule pt-6">
      <h3 className="font-serif text-title">How did it go?</h3>

      <Field label="Would you make it again?">
        <div className="flex gap-2">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setWouldMakeAgain(value)}
              aria-pressed={wouldMakeAgain === value}
              className={`min-h-tap rounded border px-4 text-small ${
                wouldMakeAgain === value
                  ? 'border-accent bg-accent-wash text-accent'
                  : 'border-rule text-ink-muted'
              }`}
            >
              {value ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="How hard was it, really?"
        hint={`The recipe estimated ${saved.recipe.difficulty.stars}.`}
      >
        <div className="flex gap-2">
          {STARS.map((stars) => (
            <button
              key={stars}
              type="button"
              onClick={() => setActualDifficulty(stars)}
              aria-pressed={actualDifficulty === stars}
              aria-label={`${stars} of 5`}
              className={`min-h-tap w-11 rounded border font-mono text-small ${
                actualDifficulty === stars
                  ? 'border-accent bg-accent-wash text-accent'
                  : 'border-rule text-ink-muted'
              }`}
            >
              {stars}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Hands-on minutes"
        hint={`The recipe estimated ${saved.recipe.time.active_minutes}.`}
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={activeMinutes}
          onChange={(e) => setActiveMinutes(e.target.value)}
          className="min-h-tap w-28 rounded border border-rule bg-paper-sunken px-3 font-mono text-body"
        />
      </Field>

      {offered.length > 0 ? (
        <Field label="Techniques you actually performed" hint="Untick anything you skipped.">
          <ul className="border-t border-rule">
            {offered.map((id) => {
              const technique = getTechnique(id);
              const checked = performed.includes(id);
              return (
                <li key={id} className="border-b border-rule">
                  <label className="flex min-h-tap cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTechnique(id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className={`text-body ${checked ? 'text-ink' : 'text-ink-muted'}`}>
                      {technique?.name ?? id}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Field>
      ) : null}

      <Field label="Notes" hint="Optional. What you would do differently.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded border border-rule bg-paper-sunken px-3 py-2 text-body"
        />
      </Field>

      {error ? <p className="mt-4 text-small text-danger">{error}</p> : null}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-tap rounded bg-accent px-6 text-small text-paper disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Log this cook'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-tap px-2 text-small text-ink-muted"
          >
            Not now
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <p className="text-micro uppercase tracking-wide text-ink-muted">{label}</p>
      {hint ? <p className="mt-1 text-small text-ink-faint">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}
