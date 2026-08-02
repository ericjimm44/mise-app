/**
 * The React binding, tested against a clock the test owns outright.
 *
 * The point of these tests is the seam: the interval inside `useCookSession`
 * must be a RE-RENDER PULSE and nothing more. So the clock handed to the hook
 * is a plain variable, moved by the test, entirely independent of whether any
 * interval callback runs. If the hook accumulated time from its own ticks, the
 * "seven minutes pass, then one tick arrives" test below would report seven
 * minutes of cooking as 250 milliseconds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CookAlerts } from './alerts';
import { currentStep, runningTimers, trayTimers } from './session';
import { remainingMs } from './timers';
import { useCookSession } from './useCookSession';
import { REST, SEAR, TEST_RECIPE } from './fixtures';

const T0 = new Date('2026-08-01T18:00:00.000Z').getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** The clock the test owns. Nothing else may move it. */
let now = T0;
const clock = (): number => now;

/** Moves the wall clock. Runs no intervals, no timeouts, nothing. */
function advanceWallClock(ms: number): void {
  now += ms;
}

/** Lets exactly one render pulse through. */
function pulse(): void {
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

/** A browser with no audio, no vibration and no wake lock. */
function bareAlerts(): CookAlerts {
  return new CookAlerts({ navigator: {} });
}

beforeEach(() => {
  now = T0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCookSession', () => {
  it('starts on the first step with nothing running', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );
    expect(currentStep(result.current.state)?.id).toBe(SEAR.id);
    expect(trayTimers(result.current.state)).toHaveLength(0);
    expect(result.current.state.now).toBe(T0);
  });

  it('advances through the single advanceStep funnel', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );

    act(() => result.current.advanceStep());
    expect(currentStep(result.current.state)?.id).toBe(REST.id);

    // The same funnel is what a voice trigger would call — there is no second
    // path (docs/decisions.md §5).
    act(() => result.current.dispatch({ type: 'advanceStep' }));
    expect(result.current.state.completedStepIds).toEqual([SEAR.id, REST.id]);
  });

  it('is correct after a long gap in which NO interval callback ran', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );

    act(() => result.current.dispatch({ type: 'startStepTimer', stepId: SEAR.id })); // 5:00
    act(() => result.current.advanceStep());
    act(() => result.current.dispatch({ type: 'startStepTimer', stepId: REST.id })); // 10:00
    expect(runningTimers(result.current.state)).toHaveLength(2);

    // Seven minutes of wall clock. The interval is installed but the event loop
    // never gets to it — this is a suspended tab.
    advanceWallClock(7 * MINUTE);
    expect(result.current.state.now).toBe(T0); // the hook has heard nothing

    // One pulse, seven minutes late. Everything lands correctly at once.
    pulse();
    expect(result.current.state.now).toBe(T0 + 7 * MINUTE);

    const [sear, rest] = result.current.state.timers;
    expect(sear?.state).toBe('fired'); // 5:00 elapsed while away
    expect(rest?.state).toBe('running');
    expect(remainingMs(rest!, now)).toBe(3 * MINUTE); // not 250ms of progress
  });

  it('keeps re-rendering while timers run, without the numbers depending on it', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );
    act(() => result.current.dispatch({ type: 'startStepTimer', stepId: SEAR.id }));

    // Pulse frequently for one minute of wall clock...
    for (let i = 0; i < 240; i++) {
      advanceWallClock(250);
      pulse();
    }
    const eager = remainingMs(result.current.state.timers[0]!, now);

    // ...and the answer is the one the arithmetic gives, to the millisecond.
    expect(eager).toBe(4 * MINUTE);
  });

  it('surfaces the honest platform message on a device that cannot alert in the background', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );

    expect(result.current.verdict.reliability).toBe('none');
    expect(result.current.showCapabilityNotice).toBe(true);
    expect(result.current.verdict.message).toMatch(/\S/);

    act(() => result.current.dismissCapabilityNotice());
    expect(result.current.showCapabilityNotice).toBe(false);
  });

  it('says nothing when the device can genuinely do the job', () => {
    const capable = new CookAlerts({
      AudioContext: function AudioContext() {} as unknown,
      navigator: { vibrate: () => true, serviceWorker: {}, wakeLock: {} },
      Notification: { permission: 'granted' },
    });
    const { result } = renderHook(() => useCookSession(TEST_RECIPE, { clock, alerts: capable }));
    expect(result.current.showCapabilityNotice).toBe(false);
  });

  it('fires the alert channels when a timer elapses, once', () => {
    const alerts = bareAlerts();
    const fire = vi.spyOn(alerts, 'fire');
    const { result } = renderHook(() => useCookSession(TEST_RECIPE, { clock, alerts }));

    act(() => result.current.dispatch({ type: 'startStepTimer', stepId: SEAR.id }));
    advanceWallClock(5 * MINUTE);
    pulse();

    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire).toHaveBeenCalledWith('active', SEAR.title);

    // Later pulses do not re-fire a timer that has already gone off.
    advanceWallClock(1 * MINUTE);
    pulse();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('does not throw on a first gesture when the platform has nothing to unlock', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );
    expect(() => act(() => result.current.onFirstGesture())).not.toThrow();
  });

  it('stops pulsing once the cook is finished', () => {
    const { result } = renderHook(() =>
      useCookSession(TEST_RECIPE, { clock, alerts: bareAlerts() }),
    );
    for (let i = 0; i < TEST_RECIPE.steps.length; i++) {
      act(() => result.current.advanceStep());
    }
    expect(result.current.state.status).toBe('complete');
    expect(vi.getTimerCount()).toBe(0);
  });
});
