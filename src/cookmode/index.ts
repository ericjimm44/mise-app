/**
 * Cook Mode — public surface.
 *
 * The rest of the app mounts `<CookMode recipe={...} />` and nothing else.
 * Everything below it is exported for tests and for the eventual voice caller
 * of `advanceStep`, not because anyone else should reach in.
 */

export { CookMode, type CookModeProps } from './CookMode';
export { useCookSession, type CookSessionApi, type UseCookSessionOptions } from './useCookSession';

export {
  advanceStep,
  canStartNextDuringCurrent,
  cookReducer,
  currentStep,
  firedTimers,
  imBehind,
  initCookSession,
  isStepUnderway,
  nextStep,
  runningTimers,
  startNextConcurrently,
  tick,
  timersForStep,
  trayTimers,
  type CookAction,
  type CookIntent,
  type CookSessionState,
  type CookStatus,
} from './session';

export {
  displayTime,
  durationMs,
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
  type TimerSpec,
} from './timers';

export {
  BEHIND_CAVEAT,
  buildBehindReport,
  classifyHold,
  holding,
  notHolding,
  type BehindReport,
  type HoldRisk,
  type HoldVerdict,
} from './behind';

export {
  backgroundVerdict,
  detectCapabilities,
  missingCapabilities,
  type BackgroundVerdict,
  type CookCapabilities,
} from './capabilities';

export { CookAlerts, type AlertOutcome } from './alerts';
