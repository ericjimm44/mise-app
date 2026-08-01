/**
 * Cook Mode — the full-screen, inverted, tap-to-advance surface.
 *
 * This is the room where legibility beats taste. Everything here is oversized,
 * high contrast, and instant; the only thing permitted to animate is a timer.
 *
 * Advancement is tap-only (docs/decisions.md §5 — no voice in v1) and every tap
 * that advances calls exactly one function: `advanceStep`. There is no second
 * path through this file.
 */

import { useEffect, useRef } from 'react';
import type { Recipe } from '@contract/types';
import { BehindPanel } from './BehindPanel';
import { StepCard } from './StepCard';
import { TimerTray } from './TimerTray';
import { missingCapabilities } from './capabilities';
import {
  canStartNextDuringCurrent,
  currentStep,
  nextStep,
  timersForStep,
  trayTimers,
} from './session';
import {
  TIMER_PULSE_CSS,
  cook,
  radius,
  rule,
  serif,
  spacing,
  surface,
  tapTarget,
  typeScale,
} from './style';
import { useCookSession, type UseCookSessionOptions } from './useCookSession';

export interface CookModeProps {
  recipe: Recipe;
  onExit?: () => void;
  options?: UseCookSessionOptions;
}

export function CookMode({ recipe, onExit, options }: CookModeProps) {
  const session = useCookSession(recipe, options ?? {});
  const { state, dispatch, advanceStep } = session;
  const gestureDone = useRef(false);

  // The first real finger on the surface is the only chance we get to unlock
  // audio on iOS. Take it, once, whatever the tap was for.
  const handleFirstGesture = (): void => {
    if (gestureDone.current) return;
    gestureDone.current = true;
    session.onFirstGesture();
  };

  useEffect(() => {
    return () => {
      void session.alerts.releaseWakeLock();
    };
    // Deliberately once, on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = currentStep(state);
  const upcoming = nextStep(state);
  const tray = trayTimers(state);
  const stepTimer = step === null ? null : (timersForStep(state, step.id).at(-1) ?? null);
  const coordination = canStartNextDuringCurrent(state);
  const firedAway = state.firedWhileAway
    .map((id) => state.timers.find((timer) => timer.id === id))
    .filter((timer): timer is NonNullable<typeof timer> => timer !== undefined);

  return (
    <div
      onPointerDown={handleFirstGesture}
      style={{
        ...surface,
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <style>{TIMER_PULSE_CSS}</style>

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: `0.5rem ${spacing.gutter}`,
          borderBottom: `1px solid ${rule.inverse}`,
        }}
      >
        {onExit === undefined ? null : (
          <button type="button" onClick={onExit} style={chromeButton}>
            Exit
          </button>
        )}
        <h1
          style={{
            ...typeScale('small'),
            ...serif,
            flex: '1 1 auto',
            margin: 0,
            color: cook.inkMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe.title}
        </h1>
        <button
          type="button"
          onClick={() => dispatch({ type: 'imBehind' })}
          style={{ ...chromeButton, borderColor: cook.warn, color: cook.warn }}
        >
          I'm behind
        </button>
      </header>

      <div style={{ position: 'relative', flex: '1 1 auto', overflowY: 'auto' }}>
        {session.showCapabilityNotice && session.verdict.message !== null ? (
          <CapabilityNotice
            message={session.verdict.message}
            remedy={session.verdict.remedy}
            detail={missingCapabilities(session.alerts.capabilities)}
            onDismiss={session.dismissCapabilityNotice}
          />
        ) : null}

        {firedAway.length > 0 ? (
          <section
            aria-label="Fired while you were away"
            style={{
              margin: spacing.gutter,
              padding: '0.875rem 1rem',
              border: `1px solid ${cook.accent}`,
              borderRadius: radius.DEFAULT,
            }}
          >
            <p style={{ ...typeScale('cookBody'), color: cook.accent, margin: 0 }}>
              {firedAway.length === 1 ? 'A timer finished' : `${firedAway.length} timers finished`}{' '}
              while Cook Mode was in the background: {firedAway.map((t) => t.label).join(', ')}.
            </p>
            <button
              type="button"
              onClick={() => dispatch({ type: 'acknowledgeFired' })}
              style={{ ...chromeButton, marginTop: '0.75rem' }}
            >
              Got it
            </button>
          </section>
        ) : null}

        {state.status === 'complete' || step === null ? (
          <CompleteCard recipe={recipe} />
        ) : (
          <>
            <StepCard
              step={step}
              stepNumber={state.stepIndex + 1}
              stepCount={recipe.steps.length}
              timer={stepTimer}
              now={state.now}
              onStartTimer={() => dispatch({ type: 'startStepTimer', stepId: step.id })}
            />

            {/* Coordination — the whole product, made loud. */}
            {coordination && upcoming !== null ? (
              <section
                aria-label="Start the next step now"
                style={{
                  margin: `0 ${spacing.gutter} ${spacing.gutter}`,
                  padding: '1rem',
                  border: `1px solid ${cook.accent}`,
                  borderRadius: radius.DEFAULT,
                }}
              >
                <p
                  style={{
                    ...typeScale('micro'),
                    color: cook.accent,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  You can run these together
                </p>
                <p style={{ ...typeScale('cookBody'), color: cook.ink, margin: '0.5rem 0 0' }}>
                  While “{step.title}” runs, start “{upcoming.title}”.
                </p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'startNextConcurrently' })}
                  style={{
                    ...tapTarget,
                    ...typeScale('cookBody'),
                    width: '100%',
                    marginTop: '0.875rem',
                    borderRadius: radius.DEFAULT,
                    border: 'none',
                    backgroundColor: cook.accent,
                    color: cook.base,
                    transitionDuration: '0ms',
                  }}
                >
                  Start it now — stay on this step
                </button>
              </section>
            ) : null}
          </>
        )}

        {state.status === 'behind' && state.behind !== null ? (
          <BehindPanel
            report={state.behind}
            onResume={() => dispatch({ type: 'resumeFromBehind' })}
          />
        ) : null}
      </div>

      <TimerTray
        timers={tray}
        now={state.now}
        onPause={(timerId) => dispatch({ type: 'pauseTimer', timerId })}
        onResume={(timerId) => dispatch({ type: 'resumeTimer', timerId })}
        onDismiss={(timerId) => dispatch({ type: 'dismissTimer', timerId })}
        onExtend={(timerId, seconds) => dispatch({ type: 'extendTimer', timerId, seconds })}
      />

      {/* Tap to advance. One target, the width of the phone, knuckle-sized. */}
      {state.status === 'complete' ? null : (
        <button
          type="button"
          data-testid="advance"
          onClick={advanceStep}
          style={{
            ...typeScale('cookBody'),
            minHeight: `calc(${spacing.cookTap} * 1.5)`,
            width: '100%',
            border: 'none',
            borderTop: `1px solid ${rule.inverse}`,
            backgroundColor: cook.accent,
            color: cook.base,
            transitionDuration: '0ms',
          }}
        >
          {state.stepIndex >= recipe.steps.length - 1 ? 'Finish' : 'Done — next step'}
        </button>
      )}
    </div>
  );
}

const chromeButton = {
  ...tapTarget,
  ...typeScale('small'),
  padding: '0 0.75rem',
  borderRadius: radius.DEFAULT,
  border: `1px solid ${rule.inverse}`,
  backgroundColor: 'transparent',
  color: cook.ink,
  transitionDuration: '0ms',
} as const;

/**
 * The honest line. Shown once, dismissible, never dressed up as a warning the
 * user caused. It exists because a timer that fails quietly is worse than one
 * that admits it can't fire.
 */
function CapabilityNotice({
  message,
  remedy,
  detail,
  onDismiss,
}: {
  message: string;
  remedy: string | null;
  detail: readonly string[];
  onDismiss: () => void;
}) {
  return (
    <section
      aria-label="What this device can do"
      style={{
        margin: spacing.gutter,
        padding: '1rem',
        border: `1px solid ${cook.warn}`,
        borderRadius: radius.DEFAULT,
      }}
    >
      <p style={{ ...typeScale('cookBody'), color: cook.warn, margin: 0 }}>{message}</p>
      {remedy === null ? null : (
        <p style={{ ...typeScale('body'), color: cook.ink, margin: '0.5rem 0 0' }}>{remedy}</p>
      )}
      {detail.length === 0 ? null : (
        <p style={{ ...typeScale('small'), color: cook.inkMuted, margin: '0.5rem 0 0' }}>
          {detail.join(' · ')}
        </p>
      )}
      <button type="button" onClick={onDismiss} style={{ ...chromeButton, marginTop: '0.875rem' }}>
        Understood
      </button>
    </section>
  );
}

function CompleteCard({ recipe }: { recipe: Recipe }) {
  return (
    <article style={{ padding: spacing.gutter }}>
      <h2 style={{ ...typeScale('cookTitle'), ...serif, margin: 0 }}>Plate it.</h2>
      <p style={{ ...typeScale('cookBody'), margin: '1rem 0 0' }}>{recipe.plating}</p>
      <p
        style={{
          ...typeScale('body'),
          color: cook.inkMuted,
          margin: '1.5rem 0 0',
          paddingTop: '1rem',
          borderTop: `1px solid ${rule.inverse}`,
        }}
      >
        {recipe.what_makes_this_restaurant_grade}
      </p>
    </article>
  );
}
