/**
 * Cook Mode timers — wall-clock arithmetic, never tick counting.
 *
 * THE RULE, stated once so it cannot be misread:
 *
 *   elapsed = Date.now() - startedAt - pausedAccumMs
 *
 * Nothing in this file decrements a counter. There is no "remaining" stored
 * anywhere. Every read derives from the wall clock and the three numbers the
 * contract's `ActiveTimer` carries. A `setInterval` in the UI exists ONLY to
 * cause a re-render — if it fires late, or is throttled to once a minute by a
 * backgrounded tab, or does not fire at all while the OS suspends the page, the
 * number this module returns on the next read is still exactly right.
 *
 * That property is the entire reason a home cook can trust three timers at once.
 */

import type { ActiveTimer, TimerType } from '@contract/types';

const MS_PER_SECOND = 1000;

export interface TimerSpec {
  id: string;
  stepId: string;
  /** Shown in the tray — must identify the step without opening it. */
  label: string;
  type: TimerType;
  durationSeconds: number;
}

/** Total length of the timer in ms. */
export function durationMs(timer: ActiveTimer): number {
  return timer.durationSeconds * MS_PER_SECOND;
}

export function startTimer(spec: TimerSpec, now: number): ActiveTimer {
  return {
    id: spec.id,
    stepId: spec.stepId,
    label: spec.label,
    type: spec.type,
    durationSeconds: spec.durationSeconds,
    startedAt: now,
    pausedAccumMs: 0,
    pausedAt: null,
    state: 'running',
  };
}

/**
 * Milliseconds of *running* time this timer has accumulated.
 *
 * While paused, the clock is frozen at `pausedAt` — the wall clock keeps moving
 * but this does not, which is what "paused" means. `pausedAccumMs` holds the
 * total of every previous pause, so the arithmetic survives any number of
 * pause/resume cycles without needing to remember them individually.
 */
export function elapsedMs(timer: ActiveTimer, now: number): number {
  if (timer.state === 'idle') return 0;
  const reference = timer.pausedAt ?? now;
  return Math.max(0, reference - timer.startedAt - timer.pausedAccumMs);
}

/** Milliseconds left. Clamped at zero — a finished timer is never negative. */
export function remainingMs(timer: ActiveTimer, now: number): number {
  return Math.max(0, durationMs(timer) - elapsedMs(timer, now));
}

/** How long ago this timer should have gone off. Zero if it hasn't yet. */
export function overdueMs(timer: ActiveTimer, now: number): number {
  return Math.max(0, elapsedMs(timer, now) - durationMs(timer));
}

/** Wall-clock instant this timer will fire. Only meaningful while running. */
export function firesAt(timer: ActiveTimer): number {
  return timer.startedAt + timer.pausedAccumMs + durationMs(timer);
}

/** 0 → just started, 1 → done. Clamped. For the tray's progress rail. */
export function progressRatio(timer: ActiveTimer, now: number): number {
  const total = durationMs(timer);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs(timer, now) / total));
}

/** True once the full duration has been served, whatever the recorded state. */
export function hasElapsed(timer: ActiveTimer, now: number): boolean {
  if (timer.state === 'idle') return false;
  return remainingMs(timer, now) === 0;
}

export function isLive(timer: ActiveTimer): boolean {
  return timer.state === 'running' || timer.state === 'paused';
}

export function pauseTimer(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.state !== 'running') return timer;
  return { ...timer, state: 'paused', pausedAt: now };
}

export function resumeTimer(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.state !== 'paused' || timer.pausedAt === null) return timer;
  return {
    ...timer,
    state: 'running',
    pausedAccumMs: timer.pausedAccumMs + (now - timer.pausedAt),
    pausedAt: null,
  };
}

export function dismissTimer(timer: ActiveTimer): ActiveTimer {
  if (timer.state === 'dismissed') return timer;
  return { ...timer, state: 'dismissed' };
}

/**
 * "Not done yet — give it another minute." Extends the duration rather than
 * restarting, so the timer's own history stays honest, and un-fires it.
 */
export function extendTimer(timer: ActiveTimer, seconds: number): ActiveTimer {
  if (timer.state === 'dismissed') return timer;
  const durationSeconds = timer.durationSeconds + seconds;
  const state: ActiveTimer['state'] = timer.state === 'fired' ? 'running' : timer.state;
  return { ...timer, durationSeconds, state };
}

/**
 * Move a timer's recorded state into line with the wall clock.
 *
 * This is the function that makes backgrounding safe. Whether the page was
 * hidden for four seconds or forty minutes, one call on return moves every
 * elapsed timer to `fired` — nothing is silently swallowed because no tick
 * happened to land on it.
 *
 * Returns the SAME object when nothing changed, so React can compare identities.
 */
export function reconcileTimer(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.state === 'running' && hasElapsed(timer, now)) {
    return { ...timer, state: 'fired' };
  }
  return timer;
}

export interface ReconcileResult {
  timers: readonly ActiveTimer[];
  /** Ids that crossed into `fired` on THIS reconcile. Drives sound and haptics. */
  justFired: readonly string[];
}

export function reconcileAll(
  timers: readonly ActiveTimer[],
  now: number,
): ReconcileResult {
  const justFired: string[] = [];
  let changed = false;
  const next = timers.map((timer) => {
    const reconciled = reconcileTimer(timer, now);
    if (reconciled !== timer) {
      changed = true;
      justFired.push(timer.id);
    }
    return reconciled;
  });
  return { timers: changed ? next : timers, justFired };
}

/**
 * mm:ss, or h:mm:ss past the hour. Seconds round UP, so a five-minute timer
 * reads "5:00" the instant it starts and only reads "0:00" when it is actually
 * done — a countdown that shows 0:00 for a whole second is a countdown that
 * lied to you at the one moment it mattered.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** What the big numerals read. A fired timer counts UP, prefixed, never hidden. */
export function displayTime(timer: ActiveTimer, now: number): string {
  if (timer.state === 'fired') {
    const over = overdueMs(timer, now);
    return over >= MS_PER_SECOND ? `+${formatDuration(over)}` : '0:00';
  }
  return formatDuration(remainingMs(timer, now));
}
