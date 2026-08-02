/**
 * The cookbook screen: saved recipes, the technique grid, and the backup file.
 *
 * Three views behind plain text links rather than a tab bar with icons — this
 * is a book you turn to a page in, not an app with a chrome bar. The screen
 * holds only which page is open; everything else comes from Dexie through the
 * hooks, so a cook logged here is reflected in the grid without any plumbing.
 */

import { useState } from 'react';
import type { SavedRecipe } from '@contract/types';
import { CookbookList } from './CookbookList';
import { SavedRecipeView } from './SavedRecipeView';
import { TechniqueGrid } from './TechniqueGrid';
import { DataPanel } from './DataPanel';

export type CookbookPage = 'recipes' | 'techniques' | 'data';

const PAGES: readonly { id: CookbookPage; label: string }[] = [
  { id: 'recipes', label: 'Cookbook' },
  { id: 'techniques', label: 'Techniques' },
  { id: 'data', label: 'Your data' },
];

export function CookbookScreen({ initialPage = 'recipes' }: { initialPage?: CookbookPage }) {
  const [page, setPage] = useState<CookbookPage>(initialPage);
  const [open, setOpen] = useState<SavedRecipe | null>(null);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="border-b border-rule">
        <ul className="mx-auto flex max-w-2xl gap-6 px-gutter">
          {PAGES.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  setPage(entry.id);
                  setOpen(null);
                }}
                aria-current={page === entry.id ? 'page' : undefined}
                className={`min-h-tap text-small ${
                  page === entry.id
                    ? 'border-b border-accent text-accent'
                    : 'text-ink-muted'
                }`}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {page === 'recipes' &&
        (open ? (
          <SavedRecipeView saved={open} onBack={() => setOpen(null)} />
        ) : (
          <CookbookList onOpen={setOpen} />
        ))}
      {page === 'techniques' && <TechniqueGrid />}
      {page === 'data' && <DataPanel />}
    </div>
  );
}
