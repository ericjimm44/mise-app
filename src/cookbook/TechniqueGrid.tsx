/**
 * The technique grid: all forty, grouped by family, locked ones included.
 *
 * This is the screen that most wants to become a dashboard — progress bars,
 * badges, percentages, a streak counter. It is deliberately none of those. It
 * is a table of contents for a skill set: a name, a word for where you are with
 * it, and the lesson one tap away. The reward for six cooks of pan sauce is the
 * word "owned" next to pan sauce, and that is enough.
 */

import { useState } from 'react';
import type { TechniqueId } from '@contract/types';
import { useTechniqueGrid } from './hooks';
import { PROGRESSION_RULE, type FamilyGroup } from './progression';
import { TechniqueDetail, LevelWord } from './TechniqueDetail';

export function TechniqueGrid({ groups }: { groups?: readonly FamilyGroup[] }) {
  const live = useTechniqueGrid();
  const families = groups ?? live;
  const [openId, setOpenId] = useState<TechniqueId | null>(null);

  const all = families.flatMap((f) => f.techniques);
  const owned = all.filter((t) => t.progress.level === 3).length;
  const started = all.filter((t) => t.progress.timesPerformed > 0).length;

  return (
    <section className="mx-auto max-w-2xl px-gutter py-section">
      <header className="border-b border-rule pb-6">
        <h2 className="font-serif text-display">Techniques</h2>
        <p className="mt-2 max-w-prose text-body text-ink-soft">
          {started === 0
            ? `Forty techniques. None cooked yet — they open as you cook them: ${PROGRESSION_RULE}.`
            : `${started} of ${all.length} cooked at least once${owned > 0 ? `, ${owned} owned` : ''}. ${PROGRESSION_RULE}.`}
        </p>
      </header>

      {families.map((family) => (
        <div key={family.family} className="mt-section">
          <h3 className="text-micro uppercase tracking-wide text-ink-muted">{family.label}</h3>
          <ul className="mt-3 border-t border-rule">
            {family.techniques.map((standing) => {
              const id = standing.technique.technique_id;
              const isOpen = openId === id;
              return (
                <li key={id} className="border-b border-rule">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : id)}
                    aria-expanded={isOpen}
                    className="flex min-h-tap w-full items-baseline justify-between gap-4 py-3 text-left"
                  >
                    <span
                      className={`font-serif text-lead ${
                        standing.progress.level === 0 ? 'text-ink-muted' : 'text-ink'
                      }`}
                    >
                      {standing.technique.name}
                    </span>
                    <LevelWord level={standing.progress.level} />
                  </button>
                  {isOpen ? <TechniqueDetail standing={standing} /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
