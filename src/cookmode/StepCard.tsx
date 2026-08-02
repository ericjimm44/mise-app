/**
 * One step, read from two feet back with wet hands.
 *
 * Order on the card is an argument, not a layout preference:
 *
 *   instruction → DONENESS CUE → timer → failure mode → chef note
 *
 * The cue sits above the countdown and carries the contract's own `cook.cue`
 * colour, because the cue is what is true and the timer is a guess. The failure
 * mode is one tap away at most, never buried — a cook who has just realised
 * something is wrong should not have to navigate.
 */

import { useState } from 'react';
import type { ActiveTimer, RecipeStep } from '@contract/types';
import { getTechnique } from '@contract/techniques';
import { displayTime } from './timers';
import {
  accentFor,
  cook,
  mono,
  radius,
  rule,
  serif,
  spacing,
  tapTarget,
  typeScale,
} from './style';

export interface StepCardProps {
  step: RecipeStep;
  stepNumber: number;
  stepCount: number;
  timer: ActiveTimer | null;
  now: number;
  onStartTimer: () => void;
}

export function StepCard({
  step,
  stepNumber,
  stepCount,
  timer,
  now,
  onStartTimer,
}: StepCardProps) {
  const [failureOpen, setFailureOpen] = useState(false);
  const technique = step.technique_id === null ? undefined : getTechnique(step.technique_id);

  return (
    <article style={{ padding: spacing.gutter }}>
      <p
        style={{
          ...typeScale('micro'),
          color: cook.inkMuted,
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Step {stepNumber} of {stepCount}
        {technique === undefined ? '' : ` · ${technique.name}`}
      </p>

      <h2 style={{ ...typeScale('cookTitle'), ...serif, margin: '0.5rem 0 0' }}>{step.title}</h2>

      <p style={{ ...typeScale('cookBody'), color: cook.ink, margin: '1rem 0 0' }}>
        {step.instruction}
      </p>

      {/* The cue outranks the countdown. Same weight, above it, its own colour. */}
      <section
        aria-label="Doneness cue"
        style={{
          marginTop: '1.25rem',
          padding: '0.875rem 1rem',
          borderLeft: `3px solid ${cook.cue}`,
          backgroundColor: cook.raised,
          borderRadius: radius.DEFAULT,
        }}
      >
        <p
          style={{
            ...typeScale('micro'),
            color: cook.cue,
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Done when
        </p>
        <p style={{ ...typeScale('cookBody'), color: cook.cue, margin: '0.35rem 0 0' }}>
          {step.doneness_cue}
        </p>
      </section>

      {step.timer_seconds !== null && step.timer_type !== null ? (
        <section aria-label="Step timer" style={{ marginTop: '1.25rem' }}>
          {timer === null || timer.state === 'dismissed' ? (
            <button
              type="button"
              onClick={onStartTimer}
              style={{
                ...tapTarget,
                ...typeScale('cookBody'),
                width: '100%',
                padding: '0 1rem',
                borderRadius: radius.DEFAULT,
                border: `1px solid ${accentFor(step.timer_type)}`,
                backgroundColor: 'transparent',
                color: accentFor(step.timer_type),
                transitionDuration: '0ms',
              }}
            >
              Start {Math.round(step.timer_seconds / 60)} min timer
              {step.timer_type === 'passive' ? ' (passive)' : ''}
            </button>
          ) : (
            <div
              className={timer.state === 'fired' ? 'mise-timer-pulse' : undefined}
              style={{
                ...typeScale('cookTimer'),
                ...mono,
                color: accentFor(timer.type),
              }}
            >
              {displayTime(timer, now)}
            </div>
          )}
          <p style={{ ...typeScale('small'), color: cook.inkMuted, margin: '0.5rem 0 0' }}>
            The timer is a guess. The cue above is the truth.
          </p>
        </section>
      ) : null}

      {/* Failure mode: always reachable, one tap, never buried. */}
      <section style={{ marginTop: '1.25rem' }}>
        <button
          type="button"
          aria-expanded={failureOpen}
          onClick={() => setFailureOpen((open) => !open)}
          style={{
            ...tapTarget,
            ...typeScale('cookBody'),
            width: '100%',
            textAlign: 'left',
            padding: '0 1rem',
            borderRadius: radius.DEFAULT,
            border: `1px solid ${cook.warn}`,
            backgroundColor: 'transparent',
            color: cook.warn,
            transitionDuration: '0ms',
          }}
        >
          {failureOpen ? 'Hide' : 'What goes wrong here'}
        </button>
        {failureOpen ? (
          <p style={{ ...typeScale('cookBody'), color: cook.warn, margin: '0.75rem 0 0' }}>
            {step.failure_mode}
          </p>
        ) : null}
      </section>

      <p
        style={{
          ...typeScale('body'),
          ...serif,
          color: cook.inkMuted,
          margin: '1.25rem 0 0',
          paddingTop: '1rem',
          borderTop: `1px solid ${rule.inverse}`,
        }}
      >
        {step.chef_note}
      </p>
    </article>
  );
}
