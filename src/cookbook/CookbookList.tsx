/**
 * The cookbook itself: what you have saved, newest first.
 *
 * A list, not a gallery. Each entry says what the dish is, when it was saved,
 * and how many times it has actually been cooked — which is the only number on
 * this screen, and it is a count of dinners rather than a score.
 */

import type { SavedRecipe } from '@contract/types';
import { useCookCountsByRecipe, useSavedRecipes } from './hooks';
import { formatDate } from './SavedRecipeView';

export function CookbookList({
  recipes,
  onOpen,
}: {
  recipes?: readonly SavedRecipe[];
  onOpen?: (saved: SavedRecipe) => void;
}) {
  const live = useSavedRecipes();
  const counts = useCookCountsByRecipe();
  const rows = recipes ?? live;

  return (
    <section className="mx-auto max-w-2xl px-gutter py-section">
      <header className="border-b border-rule pb-6">
        <h2 className="font-serif text-display">Cookbook</h2>
        <p className="mt-2 max-w-prose text-body text-ink-soft">
          Saved recipes are kept exactly as they were generated. They do not update when the
          kitchen does.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-section text-body text-ink-muted">
          Nothing saved yet. Generated recipes land here when you keep them.
        </p>
      ) : (
        <ul className="mt-section border-t border-rule">
          {rows.map((saved) => {
            const cooked = counts.get(saved.id) ?? 0;
            return (
              <li key={saved.id} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => onOpen?.(saved)}
                  className="w-full py-4 text-left"
                >
                  <h3 className="font-serif text-title">{saved.recipe.title}</h3>
                  <p className="mt-1 max-w-prose text-body text-ink-soft">
                    {saved.recipe.one_line_pitch}
                  </p>
                  <p className="mt-2 text-small text-ink-muted">
                    Saved {formatDate(saved.savedAt)} · {saved.recipe.difficulty.stars} of 5 ·{' '}
                    {saved.recipe.time.active_minutes} min hands-on ·{' '}
                    {cooked === 0
                      ? 'not cooked yet'
                      : cooked === 1
                        ? 'cooked once'
                        : `cooked ${cooked} times`}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
