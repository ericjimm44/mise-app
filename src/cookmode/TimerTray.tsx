/**
 * The persistent timer tray.
 *
 * Three at once is the stated bar. The tray is always on screen, every timer
 * carries the step that owns it, and a fired timer stays in the tray counting
 * UP until it is dismissed — a timer that quietly removes itself is a timer
 * that lied about the pan you left on.
 */

import type { ActiveTimer } from '@contract/types';
import { displayTime, progressRatio } from './timers';
import { accentFor, cook, mono, radius, rule, spacing, tapTarget, typeScale } from './style';

export interface TimerTrayProps {
  timers: readonly ActiveTimer[];
  now: number;
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onDismiss: (timerId: string) => void;
  onExtend: (timerId: string, seconds: number) => void;
}

export function TimerTray(props: TimerTrayProps) {
  const { timers, now } = props;

  if (timers.length === 0) {
    return (
      <div
        style={{ borderTop: `1px solid ${rule.inverse}`, padding: spacing.gutter, ...typeScale('small'), color: cook.inkMuted }}
      >
        No timers running.
      </div>
    );
  }

  return (
    <section
      aria-label="Running timers"
      style={{ borderTop: `1px solid ${rule.inverse}` }}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {timers.map((timer) => (
          <TimerRow key={timer.id} timer={timer} now={now} {...props} />
        ))}
      </ul>
    </section>
  );
}

function TimerRow({
  timer,
  now,
  onPause,
  onResume,
  onDismiss,
  onExtend,
}: { timer: ActiveTimer; now: number } & Omit<TimerTrayProps, 'timers' | 'now'>) {
  const colour = accentFor(timer.type);
  const fired = timer.state === 'fired';
  const paused = timer.state === 'paused';

  return (
    <li
      data-testid={`timer-${timer.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: `0.5rem ${spacing.gutter}`,
        borderTop: `1px solid ${rule.inverse}`,
        backgroundColor: fired ? cook.raised : 'transparent',
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div
          style={{
            ...typeScale('small'),
            color: fired ? colour : cook.inkMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {timer.label}
          {paused ? ' · paused' : ''}
          {fired ? ' · done' : ''}
        </div>
        <div
          className={fired ? 'mise-timer-pulse' : undefined}
          data-remaining={displayTime(timer, now)}
          style={{ ...typeScale('cookTitle'), ...mono, color: fired ? colour : cook.ink }}
        >
          {displayTime(timer, now)}
        </div>
        <div
          aria-hidden
          style={{
            height: '2px',
            marginTop: '0.35rem',
            backgroundColor: rule.inverse,
            borderRadius: radius.full,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressRatio(timer, now) * 100}%`,
              backgroundColor: colour,
              borderRadius: radius.full,
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flex: '0 0 auto' }}>
        {fired ? (
          <>
            <TrayButton label="+1 min" onClick={() => onExtend(timer.id, 60)} />
            <TrayButton label="Done" emphasis onClick={() => onDismiss(timer.id)} />
          </>
        ) : (
          <>
            <TrayButton
              label={paused ? 'Resume' : 'Pause'}
              onClick={() => (paused ? onResume(timer.id) : onPause(timer.id))}
            />
            <TrayButton label="Stop" onClick={() => onDismiss(timer.id)} />
          </>
        )}
      </div>
    </li>
  );
}

function TrayButton({
  label,
  onClick,
  emphasis = false,
}: {
  label: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...tapTarget,
        ...typeScale('small'),
        padding: '0 0.75rem',
        borderRadius: radius.DEFAULT,
        border: `1px solid ${emphasis ? cook.accent : rule.inverse}`,
        backgroundColor: emphasis ? cook.accent : 'transparent',
        color: emphasis ? cook.base : cook.ink,
        transitionDuration: '0ms',
      }}
    >
      {label}
    </button>
  );
}
