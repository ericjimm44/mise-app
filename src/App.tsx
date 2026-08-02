import { useCallback, useEffect, useState } from 'react';
import type { Ambition, GenerationRequest, Recipe, Rejection } from '@contract/types';
import { InventoryScreen, useInventoryStore } from './inventory';
import { CookbookScreen, cookbookRepository } from './cookbook';
import { CookMode } from './cookmode';
import { generateRecipe } from './generation';

/**
 * The integration seam.
 *
 * No agent was allowed to touch this file — each stayed inside its own
 * directory, which is why all four merged without a conflict. Everything here
 * is wiring: each module is consumed through its own public export surface,
 * and nothing reaches into another module's internals.
 */

type Tab = 'kitchen' | 'tonight' | 'cookbook';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'cookbook', label: 'Cookbook' },
];

const AMBITIONS: readonly { id: Ambition; label: string; blurb: string }[] = [
  { id: 'weeknight', label: 'Weeknight', blurb: 'Inside your time ceiling. One or two techniques.' },
  { id: 'elevated', label: 'Elevated', blurb: 'A technique you have not owned yet.' },
  { id: 'project', label: 'Project', blurb: 'Multi-component. Passive time is fine.' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('kitchen');
  const [cooking, setCooking] = useState<Recipe | null>(null);

  /**
   * DEV ONLY — `?demo=cook` opens Cook Mode on a fixture recipe.
   *
   * Cook Mode is the hardest surface in the app and otherwise unreachable
   * without either a live API call or a previously saved recipe, which makes
   * it painful to iterate on. The dynamic import sits inside an
   * `import.meta.env.DEV` branch so the fixture is never pulled into the
   * production bundle. This is a workshop door, not a feature.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (new URLSearchParams(window.location.search).get('demo') !== 'cook') return;
    void import('./cookmode/fixtures').then((m) => setCooking(m.TEST_RECIPE));
  }, []);

  // Cook Mode takes the whole screen — it is a different room, not a page.
  if (cooking) {
    return <CookMode recipe={cooking} onExit={() => setCooking(null)} />;
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-2xl px-gutter pt-8">
          <h1 className="text-display">Mise</h1>
          <p className="mt-1 text-small text-ink-muted">
            A lesson disguised as dinner.
          </p>
          <nav className="mt-6">
            <ul className="flex gap-6">
              {TABS.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setTab(entry.id)}
                    className={`-mb-px border-b py-3 text-small ${
                      tab === entry.id
                        ? 'border-accent text-ink'
                        : 'border-transparent text-ink-muted'
                    }`}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {tab === 'kitchen' && <InventoryScreen />}
      {tab === 'tonight' && <TonightPanel onCook={setCooking} />}
      {tab === 'cookbook' && <CookbookScreen />}
    </div>
  );
}

/**
 * Generation. Reads the kitchen from Agent C's store, the cook's history from
 * Agent D's repository, and hands both to Agent A.
 */
function TonightPanel({ onCook }: { onCook: (r: Recipe) => void }) {
  const store = useInventoryStore();
  const [ambition, setAmbition] = useState<Ambition>('weeknight');
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [rejections, setRejections] = useState<readonly Rejection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasKey = Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY);

  const run = useCallback(async () => {
    if (!store.settings) return;
    setBusy(true);
    setError(null);
    setRecipe(null);
    setRejections([]);
    try {
      const [progress, calibration] = await Promise.all([
        cookbookRepository.listTechniqueProgress(),
        cookbookRepository.getApplicableCalibration(),
      ]);
      const req: GenerationRequest = {
        inventory: store.inventory.map((i) => i.name),
        pantryStaples: store.staples.filter((s) => s.enabled).map((s) => s.name),
        exclusions: store.exclusions,
        ambition,
        servings: store.settings.servings,
        spiceTolerance: store.settings.spiceTolerance,
        weeknightActiveMinuteCeiling: store.settings.weeknightActiveMinuteCeiling,
        techniqueProgress: progress,
        ...(calibration ? { calibration } : {}),
      };
      const result = await generateRecipe(req);
      setRejections(result.rejections);
      if (result.ok) setRecipe(result.recipe);
      else setError('Every attempt was rejected. Nothing safe to show you.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [ambition, store.exclusions, store.inventory, store.settings, store.staples]);

  if (!store.ready) {
    return (
      <main className="mx-auto max-w-2xl px-gutter py-section">
        <p className="text-small text-ink-faint">Opening your kitchen…</p>
      </main>
    );
  }

  const empty = store.inventory.length === 0;

  return (
    <main className="mx-auto max-w-2xl px-gutter py-section">
      <h2 className="text-title">What are we cooking?</h2>

      <ul className="mt-6 divide-y divide-rule border-y border-rule">
        {AMBITIONS.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setAmbition(a.id)}
              className="flex w-full items-baseline justify-between gap-4 py-4 text-left"
            >
              <span>
                <span className={`text-lead ${ambition === a.id ? 'text-accent' : ''}`}>
                  {a.label}
                </span>
                <span className="mt-0.5 block text-small text-ink-muted">{a.blurb}</span>
              </span>
              {ambition === a.id && <span className="text-small text-accent">selected</span>}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-small text-ink-muted">
        {empty
          ? 'Your kitchen is empty. Add what you actually have first — nothing is generated from an empty fridge.'
          : `${store.inventory.length} ingredient${store.inventory.length === 1 ? '' : 's'} in the kitchen, plus your staples.`}
      </p>

      <button
        type="button"
        disabled={busy || empty || !hasKey}
        onClick={run}
        className="mt-6 min-h-tap w-full border border-ink bg-ink px-6 text-paper disabled:border-rule disabled:bg-transparent disabled:text-ink-faint"
      >
        {busy ? 'Generating, checking, discarding…' : 'Generate dinner'}
      </button>

      {/*
        The honesty rule applied to our own plumbing. A missing key is stated
        plainly rather than surfaced as a mystery failure after a click.
      */}
      {!hasKey && (
        <p className="mt-4 border-l-2 border-danger pl-4 text-small text-ink-soft">
          No Anthropic API key found. Copy <code>.env.example</code> to{' '}
          <code>.env.local</code>, add your key, and restart the dev server.
          Generation is the only thing that needs it — the kitchen, the cookbook
          and the technique library all work without one.
        </p>
      )}

      {error && (
        <p className="mt-4 border-l-2 border-danger pl-4 text-small text-ink-soft">{error}</p>
      )}

      {rejections.length > 0 && (
        <details className="mt-6 border-t border-rule pt-4">
          <summary className="cursor-pointer text-small text-ink-muted">
            {rejections.length} candidate{rejections.length === 1 ? '' : 's'} discarded before
            this one
          </summary>
          <ul className="mt-3 space-y-2">
            {rejections.map((r, i) => (
              <li key={i} className="text-small text-ink-muted">
                <span className="text-ink-soft">{r.reason}</span> — {r.detail}
              </li>
            ))}
          </ul>
        </details>
      )}

      {recipe && <RecipeCard recipe={recipe} onCook={() => onCook(recipe)} />}
    </main>
  );
}

function RecipeCard({ recipe, onCook }: { recipe: Recipe; onCook: () => void }) {
  return (
    <article className="mt-section border-t border-rule pt-8">
      <h3 className="text-display">{recipe.title}</h3>
      <p className="mt-2 text-lead text-ink-soft">{recipe.one_line_pitch}</p>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-rule py-4 text-small">
        <div>
          <dt className="text-ink-muted">Difficulty</dt>
          <dd className="tnum mt-1">{'★'.repeat(recipe.difficulty.stars)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Hands-on</dt>
          <dd className="tnum mt-1">{recipe.time.active_minutes} min</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Start to eating</dt>
          <dd className="tnum mt-1">{recipe.time.total_minutes} min</dd>
        </div>
      </dl>

      <p className="mt-4 text-small text-ink-muted">{recipe.difficulty.rationale}</p>

      <h4 className="mt-8 text-lead">What makes this restaurant-grade</h4>
      <p className="mt-2 text-ink-soft">{recipe.what_makes_this_restaurant_grade}</p>

      <button
        type="button"
        onClick={onCook}
        className="mt-8 min-h-tap w-full border border-accent bg-accent px-6 text-paper"
      >
        Start cooking
      </button>
    </article>
  );
}

export default App;
