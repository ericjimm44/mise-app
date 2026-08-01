import { TECHNIQUES } from '@contract/techniques';

/**
 * Placeholder shell. Agents C, A, D and B replace this with real routes as
 * their modules merge — see docs/agents/. It exists now only so the contract
 * has somewhere to prove it renders.
 */
export function App() {
  return (
    <main className="mx-auto max-w-2xl px-gutter py-section">
      <header className="border-b border-rule pb-6">
        <h1 className="text-display">Mise</h1>
        <p className="mt-2 text-lead text-ink-soft">
          A lesson disguised as dinner. The recipe is disposable; the skill is permanent.
        </p>
      </header>

      <section className="mt-section">
        <h2 className="text-title">Technique library</h2>
        <p className="mt-1 text-small text-ink-muted">
          {TECHNIQUES.length} techniques seeded. Video slots are empty by design.
        </p>
        <ul className="mt-6 divide-y divide-rule border-t border-rule">
          {TECHNIQUES.map((t) => (
            <li key={t.technique_id} className="py-4">
              <h3 className="text-lead">{t.name}</h3>
              <p className="mt-1 text-small uppercase tracking-wide text-ink-muted">{t.family}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
