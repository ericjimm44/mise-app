/**
 * One technique, opened: the mechanism, the three levels, the failure modes,
 * and the empty video slot.
 *
 * The slot renders whether or not there is a clip (`docs/decisions.md` §2).
 * An honest "not filmed yet" is the entire reason `Technique.videoUrl` exists —
 * it makes adding one real clip later data entry rather than a refactor, and it
 * refuses the stock-footage shortcut every competitor takes.
 */

import type { Technique } from '@contract/types';
import { LEVEL_LABELS, describeStanding, type TechniqueStanding } from './progression';

export function TechniqueDetail({ standing }: { standing: TechniqueStanding }) {
  const { technique, progress } = standing;

  return (
    <div className="pb-8 pt-2">
      <p className="max-w-prose text-body text-ink-soft">{technique.why_it_works}</p>

      <VideoSlot technique={technique} />

      <h4 className="mt-8 text-micro uppercase tracking-wide text-ink-muted">The three levels</h4>
      <ol className="mt-3 border-t border-rule">
        {technique.levels.map((level) => {
          const reached = progress.level >= level.level;
          return (
            <li
              key={level.level}
              className="flex gap-4 border-b border-rule py-3"
              aria-current={progress.level === level.level ? 'step' : undefined}
            >
              <span
                className={`w-24 shrink-0 text-small ${reached ? 'text-owned' : 'text-ink-faint'}`}
              >
                {level.label}
              </span>
              <span className={`text-small ${reached ? 'text-ink-soft' : 'text-ink-muted'}`}>
                {level.description}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-small text-ink-muted">{describeStanding(standing)}</p>

      <h4 className="mt-8 text-micro uppercase tracking-wide text-ink-muted">
        How it goes wrong
      </h4>
      <ul className="mt-3 space-y-2">
        {technique.common_failure_modes.map((mode) => (
          <li key={mode} className="max-w-prose text-small text-ink-soft">
            {mode}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The slot. Rendered empty, on purpose, and labelled as empty rather than
 * hidden — a missing thing you can see is honest; a missing thing you cannot is
 * a surprise later.
 */
export function VideoSlot({ technique }: { technique: Technique }) {
  if (technique.videoUrl !== null) {
    return (
      <figure className="mt-6">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video className="w-full rounded" src={technique.videoUrl} controls preload="none" />
        <figcaption className="mt-2 text-small text-ink-muted">{technique.name}</figcaption>
      </figure>
    );
  }

  return (
    <div
      className="mt-6 border border-dashed border-rule bg-paper-sunken px-4 py-6 text-small text-ink-muted"
      data-testid="video-slot"
      data-technique={technique.technique_id}
    >
      No clip for {technique.name} yet. This space is reserved for one, filmed properly —
      not for stock footage of somebody else&rsquo;s kitchen.
    </div>
  );
}

/** The level word, plainly. Owned gets the one colour that means something. */
export function LevelWord({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <span
      className={`text-small ${level === 3 ? 'text-owned' : level === 0 ? 'text-ink-faint' : 'text-ink-muted'}`}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}
