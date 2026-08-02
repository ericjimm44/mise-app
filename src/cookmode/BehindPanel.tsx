/**
 * "I'm behind."
 *
 * Everything is already paused by the time this renders. The panel's job is to
 * say — in the order that matters — what cannot wait, what can, and what to do
 * about the first group. It states that the judgment is heuristic, because the
 * alternative is a confident-sounding app getting someone's dinner wrong.
 */

import type { BehindReport, HoldVerdict } from './behind';
import { holding, notHolding } from './behind';
import { cook, radius, rule, spacing, tapTarget, typeScale } from './style';

export interface BehindPanelProps {
  report: BehindReport;
  onResume: () => void;
}

export function BehindPanel({ report, onResume }: BehindPanelProps) {
  const urgent = notHolding(report);
  const safe = holding(report);

  return (
    <section
      aria-label="You're behind"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        backgroundColor: cook.base,
        padding: spacing.gutter,
        zIndex: 2,
      }}
    >
      <h2 style={{ ...typeScale('cookTitle'), margin: 0, color: cook.ink }}>
        Everything is paused.
      </h2>
      <p style={{ ...typeScale('cookBody'), color: cook.ink, margin: '0.75rem 0 0' }}>
        {report.summary}
      </p>

      {urgent.length > 0 ? (
        <VerdictList title="Cannot wait" colour={cook.warn} verdicts={urgent} showAdvice />
      ) : null}
      {safe.length > 0 ? (
        <VerdictList title="Holds" colour={cook.cue} verdicts={safe} showAdvice={false} />
      ) : null}

      <p style={{ ...typeScale('small'), color: cook.inkMuted, margin: '1.5rem 0 0' }}>
        {report.caveat}
      </p>

      <button
        type="button"
        onClick={onResume}
        style={{
          ...tapTarget,
          ...typeScale('cookBody'),
          width: '100%',
          marginTop: '1.5rem',
          borderRadius: radius.DEFAULT,
          border: 'none',
          backgroundColor: cook.accent,
          color: cook.base,
          transitionDuration: '0ms',
        }}
      >
        I'm caught up — restart the clocks
      </button>
    </section>
  );
}

function VerdictList({
  title,
  colour,
  verdicts,
  showAdvice,
}: {
  title: string;
  colour: string;
  verdicts: readonly HoldVerdict[];
  showAdvice: boolean;
}) {
  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h3
        style={{
          ...typeScale('micro'),
          color: colour,
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {title}
      </h3>
      <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
        {verdicts.map((verdict) => (
          <li
            key={`${verdict.stepId}-${verdict.timerId ?? 'none'}`}
            data-testid={`verdict-${verdict.stepId}`}
            style={{
              padding: '0.875rem 0',
              borderTop: `1px solid ${rule.inverse}`,
            }}
          >
            <p style={{ ...typeScale('cookBody'), color: colour, margin: 0 }}>{verdict.label}</p>
            <p style={{ ...typeScale('body'), color: cook.inkMuted, margin: '0.25rem 0 0' }}>
              {verdict.reason}
            </p>
            {showAdvice ? (
              <p style={{ ...typeScale('body'), color: cook.ink, margin: '0.5rem 0 0' }}>
                {verdict.advice}
              </p>
            ) : null}
            <p style={{ ...typeScale('small'), color: cook.inkMuted, margin: '0.5rem 0 0' }}>
              Its own words: {verdict.failureMode}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
