/**
 * The React binding for the cook session.
 *
 * Everything stateful and interesting lives in `session.ts` (pure) and
 * `timers.ts` (pure arithmetic). This hook's only jobs are:
 *
 *   - inject the real clock,
 *   - run an interval whose ONLY purpose is to cause a re-render,
 *   - re-reconcile on `visibilitychange`, because a hidden tab's interval is
 *     throttled or stopped entirely and we must not rely on it,
 *   - hold the wake lock, and re-acquire it after every hide (the browser drops
 *     it silently),
 *   - turn `justFired` into sound and haptics.
 *
 * If this hook stopped running altogether, every timer would still be correct
 * the next time anything read it. That is the design.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Recipe } from '@contract/types';
import { CookAlerts } from './alerts';
import { backgroundVerdict, type BackgroundVerdict } from './capabilities';
import {
  cookReducer,
  initCookSession,
  type CookAction,
  type CookIntent,
  type CookSessionState,
} from './session';

/** 250ms is a render cadence, not a clock. Nothing is counted here. */
const RENDER_INTERVAL_MS = 250;

export interface UseCookSessionOptions {
  clock?: () => number;
  intervalMs?: number;
  alerts?: CookAlerts;
  onExit?: () => void;
}

export interface CookSessionApi {
  state: CookSessionState;
  /**
   * THE advancement funnel. Tap zones call this. Keyboard calls this. A voice
   * trigger, if one is ever added, calls this — see docs/decisions.md §5.
   */
  advanceStep: () => void;
  dispatch: (intent: CookIntent) => void;
  alerts: CookAlerts;
  verdict: BackgroundVerdict;
  /** True until the honest platform message has been shown and dismissed. */
  showCapabilityNotice: boolean;
  dismissCapabilityNotice: () => void;
  /** Call from the first real user gesture. Unlocks audio, takes the wake lock. */
  onFirstGesture: () => void;
}

export function useCookSession(
  recipe: Recipe,
  options: UseCookSessionOptions = {},
): CookSessionApi {
  const clock = options.clock ?? Date.now;
  const intervalMs = options.intervalMs ?? RENDER_INTERVAL_MS;

  const clockRef = useRef(clock);
  clockRef.current = clock;

  const alerts = useMemo(
    () => options.alerts ?? new CookAlerts(),
    [options.alerts],
  );

  const [state, rawDispatch] = useReducer(
    cookReducer,
    undefined,
    () => initCookSession(recipe, clock()),
  );

  const dispatch = useCallback((intent: CookIntent) => {
    rawDispatch({ ...intent, now: clockRef.current() } as CookAction);
  }, []);

  const advanceStep = useCallback(() => {
    dispatch({ type: 'advanceStep' });
  }, [dispatch]);

  // ---- The re-render pulse. If it is throttled, delayed, or never fires,
  // the numbers are still right — they are derived, not accumulated.
  useEffect(() => {
    if (state.status === 'complete') return;
    const id = setInterval(() => dispatch({ type: 'tick' }), intervalMs);
    return () => clearInterval(id);
  }, [dispatch, intervalMs, state.status]);

  // ---- Visibility. This is the safety net for every platform that suspends
  // background timers: on return we reconcile from the wall clock and surface
  // anything that elapsed while away rather than swallowing it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = (): void => {
      const hidden = document.visibilityState === 'hidden';
      dispatch({ type: 'visibilityChange', hidden });
      if (!hidden) {
        // Wake Lock is released by the browser whenever the page hides, without
        // telling us. Re-acquiring here is not belt-and-braces; it is required.
        void alerts.requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [alerts, dispatch]);

  // ---- Sound and haptics, driven off the reducer's `justFired`.
  useEffect(() => {
    if (state.justFired.length === 0) return;
    for (const id of state.justFired) {
      const timer = state.timers.find((t) => t.id === id);
      if (timer === undefined) continue;
      alerts.fire(timer.type, timer.label);
    }
  }, [alerts, state.justFired, state.timers]);

  useEffect(() => {
    return () => {
      void alerts.releaseWakeLock();
    };
  }, [alerts]);

  const verdict = useMemo(() => backgroundVerdict(alerts.capabilities), [alerts]);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const onFirstGesture = useCallback(() => {
    alerts.unlock();
    void alerts.requestWakeLock();
  }, [alerts]);

  const dismissCapabilityNotice = useCallback(() => setNoticeDismissed(true), []);

  return {
    state,
    advanceStep,
    dispatch,
    alerts,
    verdict,
    showCapabilityNotice: verdict.message !== null && !noticeDismissed,
    dismissCapabilityNotice,
    onFirstGesture,
  };
}
