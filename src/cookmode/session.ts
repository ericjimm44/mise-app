/**
 * Cook Mode session — one pure reducer, one funnel for advancement.
 *
 * Two design rules here are load-bearing and must not be softened:
 *
 * 1. EVERY step advance goes through the `advanceStep` action. Not one
 *    component calls `setStepIndex`. When a voice trigger is added (it is NOT
 *    in v1 — see docs/decisions.md §5), it becomes one more caller of this
 *    action rather than a second, subtly different, advancement path.
 *
 * 2. EVERY action carries `now`. The reducer never calls `Date.now()` itself,
 *    which is what makes the whole session testable against a controlled clock
 *    and what keeps timer arithmetic wall-clock-derived rather than tick-derived.
 *    The reducer reconciles every timer against `now` on every single action,
 *    so a session that receives no actions for forty minutes is still correct
 *    on the forty-first.
 */

import type { ActiveTimer, Recipe, RecipeStep } from '@contract/types';
import {
  buildBehindReport,
  type BehindReport,
  type HoldInput,
} from './behind';
import {
  dismissTimer,
  extendTimer,
  isLive,
  pauseTimer,
  reconcileAll,
  resumeTimer,
  startTimer,
} from './timers';

export type CookStatus = 'cooking' | 'behind' | 'complete';

export interface CookSessionState {
  readonly recipe: Recipe;
  /** Last wall-clock instant the session was told about. Render reads from here. */
  readonly now: number;
  readonly startedAt: number;
  readonly stepIndex: number;
  readonly completedStepIds: readonly string[];
  /**
   * Steps begun ahead of the pointer via the coordination prompt
   * ("while the thighs rest, start the sauce"). They are underway but the
   * session has NOT advanced to them.
   */
  readonly startedEarlyStepIds: readonly string[];
  readonly timers: readonly ActiveTimer[];
  /** Monotonic id source. Deterministic, so tests can name timers. */
  readonly seq: number;
  readonly status: CookStatus;
  readonly behind: BehindReport | null;
  /** Ids that fired during the action just processed. The alert layer reads this. */
  readonly justFired: readonly string[];
  /** Ids that fired while the page was hidden. Surfaced on return, never swallowed. */
  readonly firedWhileAway: readonly string[];
  readonly hidden: boolean;
}

export type CookIntent =
  /** Re-render pulse. Carries no meaning beyond "the clock moved". */
  | { readonly type: 'tick' }
  /** THE funnel. Tap, keyboard, and one day voice all land here. */
  | { readonly type: 'advanceStep' }
  | { readonly type: 'goToStep'; readonly index: number }
  | { readonly type: 'startStepTimer'; readonly stepId: string }
  /** Coordination: begin the next step without advancing away from this one. */
  | { readonly type: 'startNextConcurrently' }
  | { readonly type: 'pauseTimer'; readonly timerId: string }
  | { readonly type: 'resumeTimer'; readonly timerId: string }
  | { readonly type: 'dismissTimer'; readonly timerId: string }
  | { readonly type: 'extendTimer'; readonly timerId: string; readonly seconds: number }
  | { readonly type: 'imBehind' }
  | { readonly type: 'resumeFromBehind' }
  | { readonly type: 'visibilityChange'; readonly hidden: boolean }
  | { readonly type: 'acknowledgeFired' };

export type CookAction = CookIntent & { readonly now: number };

// ---------------------------------------------------------------------------
// Action creators. `advanceStep()` is exported by name because the brief and
// docs/decisions.md §5 both refer to it as the single advancement entry point.
// ---------------------------------------------------------------------------

export const advanceStep = (now: number): CookAction => ({ type: 'advanceStep', now });
export const tick = (now: number): CookAction => ({ type: 'tick', now });
export const imBehind = (now: number): CookAction => ({ type: 'imBehind', now });
export const startNextConcurrently = (now: number): CookAction => ({
  type: 'startNextConcurrently',
  now,
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function currentStep(state: CookSessionState): RecipeStep | null {
  return state.recipe.steps[state.stepIndex] ?? null;
}

export function nextStep(state: CookSessionState): RecipeStep | null {
  return state.recipe.steps[state.stepIndex + 1] ?? null;
}

/**
 * The coordination prompt — the single most valuable field in the schema made
 * visible. True when the current step explicitly permits parallel work and
 * there is a next step that has not already been started early.
 */
export function canStartNextDuringCurrent(state: CookSessionState): boolean {
  const step = currentStep(state);
  const next = nextStep(state);
  if (step === null || next === null) return false;
  if (!step.can_start_next_step_during) return false;
  return !state.startedEarlyStepIds.includes(next.id);
}

export function timersForStep(
  state: CookSessionState,
  stepId: string,
): readonly ActiveTimer[] {
  return state.timers.filter((timer) => timer.stepId === stepId);
}

/** Everything the tray shows: running, paused, or fired-and-unacknowledged. */
export function trayTimers(state: CookSessionState): readonly ActiveTimer[] {
  return state.timers.filter((timer) => timer.state !== 'dismissed');
}

export function runningTimers(state: CookSessionState): readonly ActiveTimer[] {
  return state.timers.filter((timer) => timer.state === 'running');
}

export function firedTimers(state: CookSessionState): readonly ActiveTimer[] {
  return state.timers.filter((timer) => timer.state === 'fired');
}

/** True when a step is underway ahead of the pointer, or is the current one. */
export function isStepUnderway(state: CookSessionState, stepId: string): boolean {
  return (
    state.startedEarlyStepIds.includes(stepId) ||
    currentStep(state)?.id === stepId ||
    state.completedStepIds.includes(stepId)
  );
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initCookSession(recipe: Recipe, now: number): CookSessionState {
  return {
    recipe,
    now,
    startedAt: now,
    stepIndex: 0,
    completedStepIds: [],
    startedEarlyStepIds: [],
    timers: [],
    seq: 0,
    status: 'cooking',
    behind: null,
    justFired: [],
    firedWhileAway: [],
    hidden: false,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function findStep(recipe: Recipe, stepId: string): RecipeStep | null {
  return recipe.steps.find((step) => step.id === stepId) ?? null;
}

function withTimer(
  state: CookSessionState,
  timerId: string,
  map: (timer: ActiveTimer) => ActiveTimer,
): readonly ActiveTimer[] {
  return state.timers.map((timer) => (timer.id === timerId ? map(timer) : timer));
}

/**
 * Start the timer a step declares, if it declares one and does not already have
 * a live one. Returns the state unchanged when there is nothing to start —
 * plenty of steps ("season and rest the board") have no duration at all.
 */
function launchTimerForStep(
  state: CookSessionState,
  step: RecipeStep,
  now: number,
): CookSessionState {
  if (step.timer_seconds === null || step.timer_type === null) return state;
  const existing = state.timers.some(
    (timer) => timer.stepId === step.id && timer.state !== 'dismissed',
  );
  if (existing) return state;

  const seq = state.seq + 1;
  const timer = startTimer(
    {
      id: `timer-${seq}`,
      stepId: step.id,
      label: step.title,
      type: step.timer_type,
      durationSeconds: step.timer_seconds,
    },
    now,
  );
  return { ...state, seq, timers: [...state.timers, timer] };
}

export function cookReducer(state: CookSessionState, action: CookAction): CookSessionState {
  // ---- Invariant: before anything else, bring every timer into line with the
  // wall clock. Whether ten actions arrived this second or none arrived for an
  // hour, the timers are correct after this line.
  const { timers, justFired } = reconcileAll(state.timers, action.now);

  const base: CookSessionState = {
    ...state,
    now: action.now,
    timers,
    justFired,
    firedWhileAway: state.hidden
      ? dedupe([...state.firedWhileAway, ...justFired])
      : state.firedWhileAway,
  };

  switch (action.type) {
    case 'tick':
      return base;

    // -----------------------------------------------------------------------
    // THE single advancement path.
    // -----------------------------------------------------------------------
    case 'advanceStep': {
      if (base.status === 'complete') return base;
      const step = currentStep(base);
      const completedStepIds =
        step === null ? base.completedStepIds : dedupe([...base.completedStepIds, step.id]);

      const isLast = base.stepIndex >= base.recipe.steps.length - 1;
      if (isLast) {
        return { ...base, completedStepIds, status: 'complete' };
      }
      // Timers belonging to the step we just left keep running. That is the
      // whole point of concurrency — leaving a step does not mean it is off
      // the heat.
      return { ...base, completedStepIds, stepIndex: base.stepIndex + 1 };
    }

    case 'goToStep': {
      const clamped = Math.min(
        Math.max(0, action.index),
        Math.max(0, base.recipe.steps.length - 1),
      );
      return { ...base, stepIndex: clamped, status: 'cooking' };
    }

    case 'startStepTimer': {
      const step = findStep(base.recipe, action.stepId);
      if (step === null) return base;
      return launchTimerForStep(base, step, action.now);
    }

    // -----------------------------------------------------------------------
    // Coordination. "While the thighs rest, start the sauce."
    // Starts the NEXT step's work WITHOUT moving the pointer off the current
    // step — the cook is now doing two things, which is the actual skill.
    // -----------------------------------------------------------------------
    case 'startNextConcurrently': {
      if (!canStartNextDuringCurrent(base)) return base;
      const next = nextStep(base);
      if (next === null) return base;
      const withEarly: CookSessionState = {
        ...base,
        startedEarlyStepIds: dedupe([...base.startedEarlyStepIds, next.id]),
      };
      return launchTimerForStep(withEarly, next, action.now);
    }

    case 'pauseTimer':
      return { ...base, timers: withTimer(base, action.timerId, (t) => pauseTimer(t, action.now)) };

    case 'resumeTimer':
      return { ...base, timers: withTimer(base, action.timerId, (t) => resumeTimer(t, action.now)) };

    case 'dismissTimer':
      return {
        ...base,
        timers: withTimer(base, action.timerId, dismissTimer),
        firedWhileAway: base.firedWhileAway.filter((id) => id !== action.timerId),
      };

    case 'extendTimer':
      return {
        ...base,
        timers: withTimer(base, action.timerId, (t) => extendTimer(t, action.seconds)),
        firedWhileAway: base.firedWhileAway.filter((id) => id !== action.timerId),
      };

    // -----------------------------------------------------------------------
    // "I'm behind" — pause everything, then say what holds and what doesn't.
    // -----------------------------------------------------------------------
    case 'imBehind': {
      const pausedByBehind = base.timers.filter((t) => t.state === 'running').map((t) => t.id);
      const paused = base.timers.map((t) =>
        t.state === 'running' ? pauseTimer(t, action.now) : t,
      );

      const inputs: HoldInput[] = [];
      for (const timer of base.timers) {
        if (!isLive(timer) && timer.state !== 'fired') continue;
        const step = findStep(base.recipe, timer.stepId);
        if (step === null) continue;
        inputs.push({ step, timerId: timer.id, timerType: timer.type, label: timer.label });
      }
      // The step you're standing at counts even when it has no timer — a sear
      // with no countdown is exactly the thing that cannot wait.
      const step = currentStep(base);
      if (step !== null && !inputs.some((input) => input.step.id === step.id)) {
        inputs.push({ step, timerId: null, timerType: step.timer_type, label: step.title });
      }

      return {
        ...base,
        timers: paused,
        status: 'behind',
        behind: buildBehindReport(inputs, pausedByBehind, action.now),
      };
    }

    case 'resumeFromBehind': {
      const report = base.behind;
      if (report === null) return { ...base, status: 'cooking' };
      const resumeIds = new Set(report.pausedByBehind);
      return {
        ...base,
        timers: base.timers.map((t) => (resumeIds.has(t.id) ? resumeTimer(t, action.now) : t)),
        status: 'cooking',
        behind: null,
      };
    }

    // -----------------------------------------------------------------------
    // Coming back from a hidden tab. The reconcile at the top of this reducer
    // has already fired anything that elapsed while away; all that is left is
    // to stop hiding it.
    // -----------------------------------------------------------------------
    case 'visibilityChange': {
      if (action.hidden) return { ...base, hidden: true };
      const elapsedWhileAway = dedupe([
        ...base.firedWhileAway,
        ...base.timers.filter((t) => t.state === 'fired').map((t) => t.id),
      ]);
      return { ...base, hidden: false, firedWhileAway: elapsedWhileAway };
    }

    case 'acknowledgeFired':
      return { ...base, firedWhileAway: [] };

    default:
      return assertNever(action);
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function assertNever(action: never): never {
  throw new Error(`Unhandled cook action: ${JSON.stringify(action)}`);
}
