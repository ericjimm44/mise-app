/**
 * A saved recipe, exactly as it was saved.
 *
 * Read-only by construction: there is no edit affordance anywhere on this
 * screen, because there is no code path that could honour one. What changed
 * since March — the fridge, the exclusions, the cook — is shown as history
 * beneath the recipe rather than folded back into it.
 */

import { useState } from 'react';
import type { CookLog, SavedRecipe } from '@contract/types';
import { getTechnique } from '@contract/techniques';
import { CookLogForm } from './CookLogForm';
import { useCookLogsFor } from './hooks';

export function SavedRecipeView({
  saved,
  onBack,
}: {
  saved: SavedRecipe;
  onBack?: () => void;
}) {
  const logs = useCookLogsFor(saved.id);
  const [logging, setLogging] = useState(false);

  return (
    <article className="mx-auto max-w-2xl px-gutter py-section">
      {onBack ? (
        <button type="button" onClick={onBack} className="min-h-tap text-small text-ink-muted">
          ← Cookbook
        </button>
      ) : null}

      <header className="border-b border-rule pb-6">
        <h2 className="font-serif text-display">{saved.recipe.title}</h2>
        <p className="mt-2 max-w-prose text-lead text-ink-soft">{saved.recipe.one_line_pitch}</p>
        <p className="mt-4 text-small text-ink-muted">
          Saved {formatDate(saved.savedAt)} · {saved.recipe.ambition} ·{' '}
          {saved.recipe.difficulty.stars} of 5 · {saved.recipe.time.active_minutes} min hands-on,{' '}
          {saved.recipe.time.total_minutes} min in all
        </p>
      </header>

      <Section title="What makes it worth cooking">
        <p className="max-w-prose text-body text-ink-soft">
          {saved.recipe.what_makes_this_restaurant_grade}
        </p>
      </Section>

      <Section title="Techniques">
        <ul className="border-t border-rule">
          {saved.recipe.skills_required.map((skill) => (
            <li key={skill.technique_id} className="flex justify-between border-b border-rule py-2">
              <span className="text-body">{getTechnique(skill.technique_id)?.name ?? skill.name}</span>
              <span className="text-small text-ink-muted">at {levelWord(skill.level)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Mise en place">
        <ul className="space-y-1">
          {saved.recipe.mise_en_place.map((item) => (
            <li key={item} className="text-body text-ink-soft">
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ingredients">
        <ul className="border-t border-rule">
          {saved.recipe.ingredients.map((ingredient) => (
            <li key={ingredient.item} className="border-b border-rule py-2">
              <span className="font-mono text-small text-ink-muted">
                {[ingredient.amount, ingredient.unit].filter(Boolean).join(' ') || '—'}
              </span>{' '}
              <span className="text-body">{ingredient.item}</span>
              {ingredient.prep ? (
                <span className="text-small text-ink-muted">, {ingredient.prep}</span>
              ) : null}
              {ingredient.substitute ? (
                <p className="text-small text-ink-muted">Or: {ingredient.substitute}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Method">
        <ol className="border-t border-rule">
          {saved.recipe.steps.map((step, index) => (
            <li key={step.id} className="border-b border-rule py-4">
              <h4 className="font-serif text-lead">
                {index + 1}. {step.title}
              </h4>
              <p className="mt-1 max-w-prose text-body text-ink-soft">{step.instruction}</p>
              <p className="mt-2 text-small text-ink-muted">Done when: {step.doneness_cue}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Plating">
        <p className="max-w-prose text-body text-ink-soft">{saved.recipe.plating}</p>
      </Section>

      <Section title="When this was generated">
        <p className="max-w-prose text-small text-ink-muted">
          From {saved.generatedFrom.inventorySnapshot.length} things in the kitchen, at{' '}
          {saved.generatedFrom.ambition} ambition
          {saved.generatedFrom.exclusionsActive.length > 0
            ? `, avoiding ${saved.generatedFrom.exclusionsActive.join(', ')}`
            : ''}
          .
        </p>
        <p className="mt-2 max-w-prose text-small text-ink-faint">
          {saved.generatedFrom.inventorySnapshot.join(' · ')}
        </p>
      </Section>

      <Section title={logs.length === 1 ? 'Cooked once' : `Cooked ${logs.length} times`}>
        {logs.length === 0 ? (
          <p className="text-small text-ink-muted">Not cooked yet.</p>
        ) : (
          <ul className="border-t border-rule">
            {logs.map((log) => (
              <CookLogRow key={log.id} log={log} />
            ))}
          </ul>
        )}

        {logging ? (
          <div className="mt-6">
            <CookLogForm
              saved={saved}
              onLogged={() => setLogging(false)}
              onCancel={() => setLogging(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="mt-4 min-h-tap rounded border border-rule px-4 text-small text-ink-soft"
          >
            Log a cook
          </button>
        )}
      </Section>
    </article>
  );
}

function CookLogRow({ log }: { log: CookLog }) {
  return (
    <li className="border-b border-rule py-3">
      <p className="text-small text-ink-muted">
        {formatDate(log.cookedAt)} · felt like {log.actualDifficulty} of 5 ·{' '}
        {log.actualActiveMinutes} min hands-on ·{' '}
        {log.wouldMakeAgain ? 'would make again' : 'would not make again'}
      </p>
      {log.notes ? <p className="mt-1 max-w-prose text-body text-ink-soft">{log.notes}</p> : null}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-section">
      <h3 className="text-micro uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function levelWord(level: 1 | 2 | 3): string {
  return level === 3 ? 'owned' : level === 2 ? 'practiced' : 'learned';
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
