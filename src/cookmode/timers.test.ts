/**
 * Timer arithmetic tests.
 *
 * The controlling idea in every test here: the clock is moved with
 * `vi.setSystemTime()`, which advances `Date.now()` WITHOUT running any pending
 * interval or timeout. If this module counted ticks, almost nothing below would
 * pass — which is exactly why the tests are written this way.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveTimer } from '@contract/types';
import {
  displayTime,
  elapsedMs,
  extendTimer,
  firesAt,
  formatDuration,
  hasElapsed,
  overdueMs,
  pauseTimer,
  progressRatio,
  reconcileAll,
  reconcileTimer,
  remainingMs,
  resumeTimer,
  startTimer,
} from './timers';

/** A fixed, unambiguous epoch so failures read as arithmetic, not as dates. */
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

/** Move the wall clock. Deliberately does NOT run timers — see the file header. */
function advanceWallClock(ms: number): number {
  vi.setSystemTime(Date.now() + ms);
  return Date.now();
}

function timer(
  id: string,
  durationSeconds: number,
  type: ActiveTimer['type'] = 'active',
): ActiveTimer {
  return startTimer(
    { id, stepId: `step-${id}`, label: `Step ${id}`, type, durationSeconds },
    Date.now(),
  );
}

// ---------------------------------------------------------------------------
// DEFINITION OF DONE: three timers at once, each one correct.
// ---------------------------------------------------------------------------

describe('three timers running simultaneously', () => {
  it('reports the correct remaining time for each, independently', () => {
    // The stated bar for the whole product: "Three timers run at once without
    // losing track." Three different durations, three different start times.
    const sear = timer('sear', 5 * 60, 'active'); // 5:00, started at T0

    advanceWallClock(30 * SECOND);
    const rest = timer('rest', 10 * 60, 'passive'); // 10:00, started at T0+0:30

    advanceWallClock(30 * SECOND);
    const sauce = timer('sauce', 4 * 60, 'active'); // 4:00, started at T0+1:00

    // Now sit at T0 + 2:00 and read all three at the same instant.
    const now = advanceWallClock(60 * SECOND);
    expect(now).toBe(T0 + 2 * MINUTE);

    // sear ran 2:00 of 5:00  → 3:00 left
    expect(remainingMs(sear, now)).toBe(3 * MINUTE);
    // rest ran 1:30 of 10:00 → 8:30 left
    expect(remainingMs(rest, now)).toBe(8 * MINUTE + 30 * SECOND);
    // sauce ran 1:00 of 4:00 → 3:00 left
    expect(remainingMs(sauce, now)).toBe(3 * MINUTE);

    expect(displayTime(sear, now)).toBe('3:00');
    expect(displayTime(rest, now)).toBe('8:30');
    expect(displayTime(sauce, now)).toBe('3:00');

    // Each keeps its own identity in the tray.
    expect([sear, rest, sauce].map((t) => t.label)).toEqual(['Step sear', 'Step rest', 'Step sauce']);
  });

  it('fires them in the right order, and only the ones that are actually done', () => {
    const sear = timer('sear', 5 * 60, 'active');
    const rest = timer('rest', 10 * 60, 'passive');
    const sauce = timer('sauce', 4 * 60, 'active');
    let timers: readonly ActiveTimer[] = [sear, rest, sauce];

    // 4:00 in: the sauce is done, nothing else is.
    let now = advanceWallClock(4 * MINUTE);
    let result = reconcileAll(timers, now);
    timers = result.timers;
    expect(result.justFired).toEqual(['sauce']);
    expect(timers.map((t) => t.state)).toEqual(['running', 'running', 'fired']);

    // 5:00 in: the sear joins it. The sauce does not re-fire.
    now = advanceWallClock(1 * MINUTE);
    result = reconcileAll(timers, now);
    timers = result.timers;
    expect(result.justFired).toEqual(['sear']);

    // 10:00 in: the rest finally goes.
    now = advanceWallClock(5 * MINUTE);
    result = reconcileAll(timers, now);
    expect(result.justFired).toEqual(['rest']);
    expect(result.timers.map((t) => t.state)).toEqual(['fired', 'fired', 'fired']);
  });

  it('lets one timer be paused without disturbing the other two', () => {
    const a = timer('a', 10 * 60);
    const b = timer('b', 10 * 60);
    const c = timer('c', 10 * 60);

    const pausedAt = advanceWallClock(2 * MINUTE);
    const bPaused = pauseTimer(b, pausedAt);

    const now = advanceWallClock(3 * MINUTE); // T0 + 5:00

    expect(remainingMs(a, now)).toBe(5 * MINUTE);
    expect(remainingMs(c, now)).toBe(5 * MINUTE);
    // b froze at 2:00 elapsed, so it still has 8:00 left however long we wait.
    expect(remainingMs(bPaused, now)).toBe(8 * MINUTE);
  });
});

// ---------------------------------------------------------------------------
// DEFINITION OF DONE: backgrounded time. No ticks fire at all.
// ---------------------------------------------------------------------------

describe('backgrounded — wall clock advances, no ticks fire', () => {
  it('still reports the correct remaining time on the next read', () => {
    const braise = timer('braise', 45 * 60);

    // Simulate a suspended tab: install an interval that WOULD tick, then move
    // the wall clock without ever letting the event loop run it. This is what
    // an OS-suspended page does — the callback never happens, but time passes.
    const tickSpy = vi.fn();
    setInterval(tickSpy, 250);

    const now = advanceWallClock(20 * MINUTE);

    expect(tickSpy).not.toHaveBeenCalled(); // proof: zero ticks in 20 minutes
    expect(elapsedMs(braise, now)).toBe(20 * MINUTE);
    expect(remainingMs(braise, now)).toBe(25 * MINUTE);
    expect(displayTime(braise, now)).toBe('25:00');
  });

  it('marks a timer that elapsed entirely in the background as fired, once', () => {
    const rest = timer('rest', 10 * 60);
    const tickSpy = vi.fn();
    setInterval(tickSpy, 250);

    // Gone for half an hour. The timer was due 20 minutes ago.
    const now = advanceWallClock(30 * MINUTE);
    expect(tickSpy).not.toHaveBeenCalled();

    const { timers, justFired } = reconcileAll([rest], now);
    expect(justFired).toEqual(['rest']);
    expect(timers[0]?.state).toBe('fired');

    // It is not swallowed — it counts UP, showing how long it has been sitting.
    expect(overdueMs(timers[0]!, now)).toBe(20 * MINUTE);
    expect(displayTime(timers[0]!, now)).toBe('+20:00');

    // A second reconcile does not re-fire it.
    expect(reconcileAll(timers, now).justFired).toEqual([]);
  });

  it('is unaffected by how many times, or how few, it is read', () => {
    // Read once after 10 minutes...
    const lazy = timer('lazy', 15 * 60);
    // ...versus read every second for 10 minutes. Same answer.
    const eager = timer('eager', 15 * 60);

    let now = Date.now();
    for (let i = 0; i < 600; i++) {
      now = advanceWallClock(SECOND);
      remainingMs(eager, now); // reads that would corrupt a tick counter
    }

    expect(remainingMs(eager, now)).toBe(5 * MINUTE);
    expect(remainingMs(lazy, now)).toBe(5 * MINUTE);
    expect(remainingMs(eager, now)).toBe(remainingMs(lazy, now));
  });

  it('survives a gap longer than the timer several times over', () => {
    const t = timer('t', 60);
    const now = advanceWallClock(6 * 60 * MINUTE); // six hours
    expect(remainingMs(t, now)).toBe(0); // clamped, never negative
    expect(hasElapsed(t, now)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pause / resume arithmetic
// ---------------------------------------------------------------------------

describe('pause and resume', () => {
  it('accumulates pausedAccumMs correctly across multiple cycles', () => {
    let t = timer('t', 10 * 60);

    // Cycle 1: run 1:00, pause 2:00.
    let now = advanceWallClock(1 * MINUTE);
    t = pauseTimer(t, now);
    expect(t.pausedAt).toBe(now);
    now = advanceWallClock(2 * MINUTE);
    t = resumeTimer(t, now);
    expect(t.pausedAccumMs).toBe(2 * MINUTE);
    expect(t.pausedAt).toBeNull();
    expect(remainingMs(t, now)).toBe(9 * MINUTE);

    // Cycle 2: run 3:00, pause 5:00.
    now = advanceWallClock(3 * MINUTE);
    t = pauseTimer(t, now);
    now = advanceWallClock(5 * MINUTE);
    t = resumeTimer(t, now);
    expect(t.pausedAccumMs).toBe(7 * MINUTE); // 2:00 + 5:00
    expect(elapsedMs(t, now)).toBe(4 * MINUTE); // 1:00 + 3:00
    expect(remainingMs(t, now)).toBe(6 * MINUTE);

    // Cycle 3: run 1:30, pause 30:00 — far longer than the timer itself.
    now = advanceWallClock(90 * SECOND);
    t = pauseTimer(t, now);
    now = advanceWallClock(30 * MINUTE);
    // Paused means paused: it did not fire while stopped.
    expect(reconcileTimer(t, now).state).toBe('paused');
    expect(remainingMs(t, now)).toBe(4 * MINUTE + 30 * SECOND);

    t = resumeTimer(t, now);
    expect(t.pausedAccumMs).toBe(37 * MINUTE); // 2:00 + 5:00 + 30:00
    expect(remainingMs(t, now)).toBe(4 * MINUTE + 30 * SECOND);

    // And it still fires at the right wall-clock instant afterwards.
    expect(firesAt(t)).toBe(now + 4 * MINUTE + 30 * SECOND);
    now = advanceWallClock(4 * MINUTE + 30 * SECOND);
    expect(reconcileTimer(t, now).state).toBe('fired');
  });

  it('freezes the countdown while paused, however long the pause', () => {
    let t = timer('t', 5 * 60);
    const pausedAt = advanceWallClock(1 * MINUTE);
    t = pauseTimer(t, pausedAt);

    const remainingAtPause = remainingMs(t, pausedAt);
    advanceWallClock(3 * 60 * MINUTE);
    expect(remainingMs(t, Date.now())).toBe(remainingAtPause);
    expect(remainingMs(t, Date.now())).toBe(4 * MINUTE);
  });

  it('ignores pausing something not running and resuming something not paused', () => {
    const t = timer('t', 60);
    expect(resumeTimer(t, Date.now())).toBe(t); // already running — same object
    const paused = pauseTimer(t, Date.now());
    expect(pauseTimer(paused, Date.now())).toBe(paused); // already paused
  });
});

// ---------------------------------------------------------------------------
// Presentation of time
// ---------------------------------------------------------------------------

describe('formatting', () => {
  it('rounds seconds UP so a running timer never reads 0:00', () => {
    // A countdown that shows 0:00 for a whole second lies at the one moment
    // that matters.
    expect(formatDuration(1)).toBe('0:01');
    expect(formatDuration(999)).toBe('0:01');
    expect(formatDuration(1000)).toBe('0:01');
    expect(formatDuration(1001)).toBe('0:02');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('shows hours only when there are hours', () => {
    expect(formatDuration(59 * MINUTE)).toBe('59:00');
    expect(formatDuration(60 * MINUTE)).toBe('1:00:00');
    expect(formatDuration(4 * 60 * MINUTE + 5 * MINUTE + 9 * SECOND)).toBe('4:05:09');
  });

  it('reads the full duration at the instant a timer starts', () => {
    const t = timer('t', 5 * 60);
    expect(displayTime(t, Date.now())).toBe('5:00');
  });

  it('tracks progress from 0 to 1 and clamps there', () => {
    const t = timer('t', 100);
    expect(progressRatio(t, Date.now())).toBe(0);
    expect(progressRatio(t, advanceWallClock(50 * SECOND))).toBeCloseTo(0.5);
    expect(progressRatio(t, advanceWallClock(500 * SECOND))).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// "Not done yet"
// ---------------------------------------------------------------------------

describe('extending a fired timer', () => {
  it('un-fires it and gives back exactly the added time', () => {
    const t = timer('t', 60);
    const now = advanceWallClock(75 * SECOND);
    const fired = reconcileTimer(t, now);
    expect(fired.state).toBe('fired');

    const extended = extendTimer(fired, 60);
    expect(extended.state).toBe('running');
    // 60s served past a 60s timer, +60s added → 45s left.
    expect(remainingMs(extended, now)).toBe(45 * SECOND);
    // The original start time is untouched — the timer's history stays honest.
    expect(extended.startedAt).toBe(t.startedAt);
  });
});
