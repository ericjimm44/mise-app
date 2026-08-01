/**
 * Cook session tests — the reducer, end to end.
 *
 * Same clock discipline as `timers.test.ts`: `vi.setSystemTime()` moves
 * `Date.now()` and runs nothing. Every action carries the clock explicitly, so
 * a session that receives no actions for an hour is still correct on the next
 * one — which is the property that makes backgrounding survivable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canStartNextDuringCurrent,
  cookReducer,
  currentStep,
  firedTimers,
  initCookSession,
  nextStep,
  runningTimers,
  timersForStep,
  trayTimers,
  type CookIntent,
  type CookSessionState,
} from './session';
import { holding, notHolding } from './behind';
import { displayTime, remainingMs } from './timers';
import { PLATE, REST, SAUCE, SEAR, TEST_RECIPE } from './fixtures';

const T0 = new Date('2026-08-01T18:00:00.000Z').getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Advances the wall clock. Runs no intervals — see the file header. */
function advanceWallClock(ms: number): number {
  vi.setSystemTime(Date.now() + ms);
  return Date.now();
}

/** Dispatch with the current wall clock, exactly as `useCookSession` does. */
function send(state: CookSessionState, intent: CookIntent): CookSessionState {
  return cookReducer(state, { ...intent, now: Date.now() } as never);
}

function newSession(): CookSessionState {
  return initCookSession(TEST_RECIPE, Date.now());
}

/**
 * The scenario the brief describes: sear, then rest, and while the thighs rest
 * start the sauce. Leaves three timers running with the pointer on the rest.
 */
function threeRunning(): CookSessionState {
  let state = newSession();
  state = send(state, { type: 'startStepTimer', stepId: SEAR.id }); // timer-1, 5:00 active
  state = send(state, { type: 'advanceStep' });
  state = send(state, { type: 'startStepTimer', stepId: REST.id }); // timer-2, 10:00 passive
  state = send(state, { type: 'startNextConcurrently' }); // timer-3, 4:00 active
  return state;
}

// ---------------------------------------------------------------------------
// DEFINITION OF DONE: three timers at once, in a real session.
// ---------------------------------------------------------------------------

describe('three timers running simultaneously in one session', () => {
  it('runs all three at once and reports each one correctly', () => {
    const state = threeRunning();

    expect(runningTimers(state)).toHaveLength(3);
    expect(trayTimers(state).map((t) => t.label)).toEqual([
      'Sear the thighs',
      'Rest the thighs',
      'Build the pan sauce',
    ]);
    // Each timer knows which step owns it — the tray must identify a step
    // without opening it.
    expect(trayTimers(state).map((t) => t.stepId)).toEqual([SEAR.id, REST.id, SAUCE.id]);
    expect(trayTimers(state).map((t) => t.type)).toEqual(['active', 'passive', 'active']);

    const now = advanceWallClock(90 * SECOND);
    const read = send(state, { type: 'tick' });

    const [sear, rest, sauce] = read.timers;
    expect(remainingMs(sear!, now)).toBe(3 * MINUTE + 30 * SECOND); // 5:00 - 1:30
    expect(remainingMs(rest!, now)).toBe(8 * MINUTE + 30 * SECOND); // 10:00 - 1:30
    expect(remainingMs(sauce!, now)).toBe(2 * MINUTE + 30 * SECOND); // 4:00 - 1:30
    expect([sear, rest, sauce].map((t) => displayTime(t!, now))).toEqual([
      '3:30',
      '8:30',
      '2:30',
    ]);
  });

  it('fires each of the three at its own moment, in duration order', () => {
    let state = threeRunning();

    advanceWallClock(4 * MINUTE);
    state = send(state, { type: 'tick' });
    expect(state.justFired).toEqual(['timer-3']); // the 4:00 sauce
    expect(firedTimers(state).map((t) => t.label)).toEqual(['Build the pan sauce']);

    advanceWallClock(1 * MINUTE);
    state = send(state, { type: 'tick' });
    expect(state.justFired).toEqual(['timer-1']); // the 5:00 sear

    advanceWallClock(5 * MINUTE);
    state = send(state, { type: 'tick' });
    expect(state.justFired).toEqual(['timer-2']); // the 10:00 rest
    expect(firedTimers(state)).toHaveLength(3);
  });

  it('pauses one of the three without touching the other two', () => {
    let state = threeRunning();
    advanceWallClock(1 * MINUTE);
    state = send(state, { type: 'pauseTimer', timerId: 'timer-2' });

    const now = advanceWallClock(2 * MINUTE); // T0 + 3:00
    state = send(state, { type: 'tick' });

    expect(state.timers.map((t) => t.state)).toEqual(['running', 'paused', 'running']);
    expect(remainingMs(state.timers[0]!, now)).toBe(2 * MINUTE); // ran the full 3:00
    expect(remainingMs(state.timers[1]!, now)).toBe(9 * MINUTE); // froze at 1:00
    expect(remainingMs(state.timers[2]!, now)).toBe(1 * MINUTE); // ran the full 3:00
  });
});

// ---------------------------------------------------------------------------
// DEFINITION OF DONE: backgrounded, with no ticks at all.
// ---------------------------------------------------------------------------

describe('backgrounded session — no ticks fire for the whole absence', () => {
  it('recomputes every timer from the wall clock on return', () => {
    let state = threeRunning();

    const tickSpy = vi.fn();
    setInterval(tickSpy, 250); // the render pulse, which will never run

    state = send(state, { type: 'visibilityChange', hidden: true });
    const now = advanceWallClock(7 * MINUTE);
    expect(tickSpy).not.toHaveBeenCalled(); // proof: zero ticks while away

    state = send(state, { type: 'visibilityChange', hidden: false });

    // 7:00 gone. The 4:00 sauce and the 5:00 sear both elapsed; the 10:00 rest
    // did not — and it has exactly 3:00 left, not "3:00 minus whatever the
    // interval missed".
    expect(state.timers[0]!.state).toBe('fired');
    expect(state.timers[1]!.state).toBe('running');
    expect(state.timers[2]!.state).toBe('fired');
    expect(remainingMs(state.timers[1]!, now)).toBe(3 * MINUTE);
    expect(displayTime(state.timers[1]!, now)).toBe('3:00');
  });

  it('reports what fired while away rather than swallowing it', () => {
    let state = threeRunning();
    state = send(state, { type: 'visibilityChange', hidden: true });
    advanceWallClock(7 * MINUTE);
    state = send(state, { type: 'visibilityChange', hidden: false });

    // Both of them, named, waiting to be acknowledged.
    expect([...state.firedWhileAway].sort()).toEqual(['timer-1', 'timer-3']);
    expect(state.hidden).toBe(false);

    state = send(state, { type: 'acknowledgeFired' });
    expect(state.firedWhileAway).toEqual([]);
  });

  it('catches a timer that came and went entirely during the absence', () => {
    let state = threeRunning();
    state = send(state, { type: 'visibilityChange', hidden: true });
    const now = advanceWallClock(2 * 60 * MINUTE); // two hours
    state = send(state, { type: 'visibilityChange', hidden: false });

    expect(state.timers.every((t) => t.state === 'fired')).toBe(true);
    expect(state.firedWhileAway).toHaveLength(3);
    // The rest was due 1h50m ago, and says so instead of showing 0:00.
    expect(displayTime(state.timers[1]!, now)).toBe('+1:50:00');
  });

  it('is correct even if the very first action after the gap is unrelated', () => {
    // Nothing dispatches a tick; the next thing that happens is a tap.
    let state = threeRunning();
    advanceWallClock(6 * MINUTE);
    state = send(state, { type: 'advanceStep' });

    // The reconcile at the top of the reducer ran regardless of the action.
    expect([...state.justFired].sort()).toEqual(['timer-1', 'timer-3']);
    expect(remainingMs(state.timers[1]!, Date.now())).toBe(4 * MINUTE);
  });
});

// ---------------------------------------------------------------------------
// advanceStep — the single funnel
// ---------------------------------------------------------------------------

describe('advanceStep', () => {
  it('moves one step at a time and records what was completed', () => {
    let state = newSession();
    expect(currentStep(state)?.id).toBe(SEAR.id);

    state = send(state, { type: 'advanceStep' });
    expect(currentStep(state)?.id).toBe(REST.id);
    expect(state.completedStepIds).toEqual([SEAR.id]);

    state = send(state, { type: 'advanceStep' });
    expect(currentStep(state)?.id).toBe(SAUCE.id);
    expect(state.completedStepIds).toEqual([SEAR.id, REST.id]);
  });

  it('leaves timers from earlier steps running — advancing is not turning off the hob', () => {
    let state = newSession();
    state = send(state, { type: 'startStepTimer', stepId: SEAR.id });
    advanceWallClock(30 * SECOND);
    state = send(state, { type: 'advanceStep' });

    expect(currentStep(state)?.id).toBe(REST.id);
    expect(runningTimers(state)).toHaveLength(1);
    expect(runningTimers(state)[0]?.stepId).toBe(SEAR.id);
    expect(remainingMs(runningTimers(state)[0]!, Date.now())).toBe(4 * MINUTE + 30 * SECOND);
  });

  it('completes at the last step and refuses to run off the end', () => {
    let state = newSession();
    for (let i = 0; i < TEST_RECIPE.steps.length; i++) {
      state = send(state, { type: 'advanceStep' });
    }
    expect(state.status).toBe('complete');
    expect(currentStep(state)?.id).toBe(PLATE.id);
    expect(state.completedStepIds).toHaveLength(TEST_RECIPE.steps.length);

    const after = send(state, { type: 'advanceStep' });
    expect(after.stepIndex).toBe(state.stepIndex);
    expect(after.status).toBe('complete');
  });

  it('does not double-record a step revisited via goToStep', () => {
    let state = newSession();
    state = send(state, { type: 'advanceStep' });
    state = send(state, { type: 'goToStep', index: 0 });
    state = send(state, { type: 'advanceStep' });
    expect(state.completedStepIds).toEqual([SEAR.id]);
  });
});

// ---------------------------------------------------------------------------
// Coordination — can_start_next_step_during
// ---------------------------------------------------------------------------

describe('can_start_next_step_during', () => {
  it('surfaces the next step from a step that permits it', () => {
    let state = newSession();
    expect(canStartNextDuringCurrent(state)).toBe(false); // the sear does not

    state = send(state, { type: 'advanceStep' }); // now on the rest
    expect(currentStep(state)?.id).toBe(REST.id);
    expect(currentStep(state)?.can_start_next_step_during).toBe(true);
    expect(canStartNextDuringCurrent(state)).toBe(true);
    expect(nextStep(state)?.id).toBe(SAUCE.id);
  });

  it('starts the next step WITHOUT advancing away from the current one', () => {
    let state = newSession();
    state = send(state, { type: 'advanceStep' }); // on the rest
    const indexBefore = state.stepIndex;

    state = send(state, { type: 'startNextConcurrently' });

    // The pointer has not moved. That is the entire point.
    expect(state.stepIndex).toBe(indexBefore);
    expect(currentStep(state)?.id).toBe(REST.id);
    expect(state.completedStepIds).toEqual([SEAR.id]); // the rest is NOT complete

    // But the sauce is underway, with its own timer.
    expect(state.startedEarlyStepIds).toEqual([SAUCE.id]);
    const sauceTimers = timersForStep(state, SAUCE.id);
    expect(sauceTimers).toHaveLength(1);
    expect(sauceTimers[0]?.state).toBe('running');
    expect(sauceTimers[0]?.durationSeconds).toBe(240);
  });

  it('does nothing from a step that does not permit it', () => {
    const state = newSession(); // on the sear, which forbids it
    const after = send(state, { type: 'startNextConcurrently' });
    expect(after.startedEarlyStepIds).toEqual([]);
    expect(after.timers).toHaveLength(0);
    expect(after.stepIndex).toBe(state.stepIndex);
  });

  it('will not start the same step twice, and stops offering once taken', () => {
    let state = newSession();
    state = send(state, { type: 'advanceStep' });
    state = send(state, { type: 'startNextConcurrently' });
    expect(canStartNextDuringCurrent(state)).toBe(false);

    state = send(state, { type: 'startNextConcurrently' });
    expect(timersForStep(state, SAUCE.id)).toHaveLength(1);
  });

  it('does not restart the timer when the session catches up to that step', () => {
    let state = newSession();
    state = send(state, { type: 'advanceStep' });
    state = send(state, { type: 'startNextConcurrently' });
    const startedAt = timersForStep(state, SAUCE.id)[0]?.startedAt;

    advanceWallClock(60 * SECOND);
    state = send(state, { type: 'advanceStep' }); // now standing on the sauce
    state = send(state, { type: 'startStepTimer', stepId: SAUCE.id });

    // Still one timer, still the original one — it has been running a minute.
    const timers = timersForStep(state, SAUCE.id);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.startedAt).toBe(startedAt);
    expect(remainingMs(timers[0]!, Date.now())).toBe(3 * MINUTE);
  });
});

// ---------------------------------------------------------------------------
// "I'm behind"
// ---------------------------------------------------------------------------

describe("I'm behind", () => {
  it('pauses every running timer', () => {
    let state = threeRunning();
    advanceWallClock(90 * SECOND);
    state = send(state, { type: 'imBehind' });

    expect(state.status).toBe('behind');
    expect(runningTimers(state)).toHaveLength(0);
    expect(state.timers.every((t) => t.state === 'paused')).toBe(true);
    expect(state.behind?.pausedByBehind).toEqual(['timer-1', 'timer-2', 'timer-3']);
  });

  it('classifies passive as holding and active as not', () => {
    let state = threeRunning();
    state = send(state, { type: 'imBehind' });
    const report = state.behind;
    expect(report).not.toBeNull();

    const holds = holding(report!).map((v) => v.stepId);
    const urgent = notHolding(report!).map((v) => v.stepId);

    // The rest is passive — waiting is what it is doing anyway.
    expect(holds).toEqual([REST.id]);
    // The sear and the sauce are active and cannot be left.
    expect(urgent).toEqual([SEAR.id, SAUCE.id]);

    for (const verdict of notHolding(report!)) {
      expect(verdict.risk).toBe('needs_attention');
      expect(verdict.advice).not.toBe('');
      // The step's own words are surfaced so the cook can overrule us.
      expect(verdict.failureMode).not.toBe('');
    }
  });

  it('says something specific rather than nothing', () => {
    let state = threeRunning();
    state = send(state, { type: 'imBehind' });
    const report = state.behind!;

    expect(report.summary).toContain('Sear the thighs');
    expect(report.summary).toContain('Build the pan sauce');
    expect(report.summary).toContain('cannot wait');
    // And it admits what kind of judgment this is.
    expect(report.caveat).toContain('judgment');
  });

  it('includes the step you are standing on even when it has no timer', () => {
    let state = newSession();
    state = send(state, { type: 'advanceStep' });
    state = send(state, { type: 'advanceStep' });
    state = send(state, { type: 'advanceStep' }); // on PLATE, no timer at all
    state = send(state, { type: 'imBehind' });

    const ids = state.behind!.entries.map((v) => v.stepId);
    expect(ids).toContain(PLATE.id);
  });

  it('freezes remaining time for the whole pause, then resumes exactly there', () => {
    let state = threeRunning();
    advanceWallClock(2 * MINUTE);
    state = send(state, { type: 'imBehind' });

    const frozen = state.timers.map((t) => remainingMs(t, Date.now()));
    expect(frozen).toEqual([3 * MINUTE, 8 * MINUTE, 2 * MINUTE]);

    // Half an hour of panic. Nothing moves and nothing fires.
    const later = advanceWallClock(30 * MINUTE);
    state = send(state, { type: 'tick' });
    expect(state.timers.map((t) => remainingMs(t, later))).toEqual(frozen);
    expect(firedTimers(state)).toHaveLength(0);

    state = send(state, { type: 'resumeFromBehind' });
    expect(state.status).toBe('cooking');
    expect(state.behind).toBeNull();
    expect(state.timers.every((t) => t.state === 'running')).toBe(true);
    expect(state.timers.map((t) => remainingMs(t, later))).toEqual(frozen);

    // And they carry on from there.
    const after = advanceWallClock(1 * MINUTE);
    state = send(state, { type: 'tick' });
    expect(state.timers.map((t) => remainingMs(t, after))).toEqual([
      2 * MINUTE,
      7 * MINUTE,
      1 * MINUTE,
    ]);
  });

  it('does not resume a timer the cook had paused by hand before panicking', () => {
    let state = threeRunning();
    state = send(state, { type: 'pauseTimer', timerId: 'timer-2' });
    state = send(state, { type: 'imBehind' });
    expect(state.behind?.pausedByBehind).toEqual(['timer-1', 'timer-3']);

    state = send(state, { type: 'resumeFromBehind' });
    expect(state.timers.map((t) => t.state)).toEqual(['running', 'paused', 'running']);
  });
});

// ---------------------------------------------------------------------------
// Timer housekeeping through the session
// ---------------------------------------------------------------------------

describe('timer housekeeping', () => {
  it('never starts a timer for a step that has no duration', () => {
    let state = newSession();
    state = send(state, { type: 'startStepTimer', stepId: PLATE.id });
    expect(state.timers).toHaveLength(0);
  });

  it('drops a dismissed timer from the tray but keeps it in the record', () => {
    let state = threeRunning();
    state = send(state, { type: 'dismissTimer', timerId: 'timer-1' });
    expect(trayTimers(state)).toHaveLength(2);
    expect(state.timers).toHaveLength(3);
  });

  it('lets a step be re-timed once its timer has been dismissed', () => {
    let state = newSession();
    state = send(state, { type: 'startStepTimer', stepId: SEAR.id });
    state = send(state, { type: 'dismissTimer', timerId: 'timer-1' });
    state = send(state, { type: 'startStepTimer', stepId: SEAR.id });
    expect(timersForStep(state, SEAR.id)).toHaveLength(2);
  });

  it('adds a minute to a fired timer and clears it from the away list', () => {
    let state = newSession();
    state = send(state, { type: 'startStepTimer', stepId: SEAR.id });
    state = send(state, { type: 'visibilityChange', hidden: true });
    advanceWallClock(5 * MINUTE);
    state = send(state, { type: 'visibilityChange', hidden: false });
    expect(state.firedWhileAway).toEqual(['timer-1']);

    state = send(state, { type: 'extendTimer', timerId: 'timer-1', seconds: 60 });
    expect(state.timers[0]?.state).toBe('running');
    expect(remainingMs(state.timers[0]!, Date.now())).toBe(1 * MINUTE);
    expect(state.firedWhileAway).toEqual([]);
  });
});
