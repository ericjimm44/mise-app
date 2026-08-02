/**
 * Platform capability detection, and the honest sentence that follows from it.
 *
 * This is the file the whole "degrade visibly, never silently" requirement
 * lives in. The PWA decision (docs/decisions.md §1) bought us a lot and cost us
 * exactly one thing: on iOS Safari there is no Vibration API, Web Audio is
 * suspended until a user gesture and re-suspended when the page is hidden, and
 * background timers are throttled. So Cook Mode cannot promise it will wake you.
 *
 * What it CAN promise, always, on every platform, is that the number on screen
 * is correct — because the timers are wall-clock derived (see `timers.ts`). The
 * message below draws exactly that line and does not blur it. A cook who is
 * told "keep this on screen, the count is exact" can plan around it. A cook who
 * is told nothing and hears no beep has a ruined dish and no idea why.
 */

export interface CapabilityHost {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
  navigator?: {
    vibrate?: unknown;
    wakeLock?: unknown;
    serviceWorker?: unknown;
  };
  Notification?: { permission?: string };
  isSecureContext?: boolean;
}

export interface CookCapabilities {
  /** An AudioContext constructor exists. Says nothing about it being allowed to play. */
  audio: boolean;
  /** navigator.vibrate exists. Absent on every iOS browser. */
  vibration: boolean;
  /** navigator.wakeLock exists — we can ask the screen to stay on. */
  wakeLock: boolean;
  /** A service worker is available to hold a notification. */
  serviceWorker: boolean;
  /** The Notification API exists. */
  notifications: boolean;
  /** Notification permission has actually been granted. */
  notificationsGranted: boolean;
}

export function detectCapabilities(
  host: CapabilityHost = globalThis as unknown as CapabilityHost,
): CookCapabilities {
  const nav = host.navigator;
  return {
    audio: typeof host.AudioContext === 'function' || typeof host.webkitAudioContext === 'function',
    vibration: typeof nav?.vibrate === 'function',
    wakeLock: nav?.wakeLock !== undefined && nav.wakeLock !== null,
    serviceWorker: nav?.serviceWorker !== undefined && nav.serviceWorker !== null,
    notifications: host.Notification !== undefined && host.Notification !== null,
    notificationsGranted: host.Notification?.permission === 'granted',
  };
}

export type BackgroundReliability =
  /** A notification will fire from the service worker even with the screen off. */
  | 'reliable'
  /** Sound/haptics will fire, but only while the page is alive. Screen lock may kill it. */
  | 'foreground_only'
  /** Nothing will fire. The screen is the alarm. */
  | 'none';

export interface BackgroundVerdict {
  reliability: BackgroundReliability;
  /**
   * One honest line, shown once. Null only when the device can genuinely do
   * everything — and even then we do not congratulate ourselves about it.
   */
  message: string | null;
  /** What the cook can do to improve matters, if anything. Null when nothing helps. */
  remedy: string | null;
}

export function backgroundVerdict(caps: CookCapabilities): BackgroundVerdict {
  if (caps.notificationsGranted && caps.serviceWorker) {
    return { reliability: 'reliable', message: null, remedy: null };
  }

  const canSignalInForeground = caps.audio || caps.vibration;

  if (!canSignalInForeground) {
    return {
      reliability: 'none',
      message:
        'This browser will not let Mise make a sound or buzz. Timers keep exact time, but nothing will alert you — watch the screen.',
      remedy: caps.notifications
        ? 'Allowing notifications would let a timer reach you with the screen off.'
        : null,
    };
  }

  return {
    reliability: 'foreground_only',
    message: caps.notifications
      ? 'Mise can only alert you while Cook Mode is on screen. If you lock the phone or switch apps, a timer may pass in silence — the count stays exact either way.'
      : 'Mise can only alert you while Cook Mode is on screen; this browser has no way to reach you in the background. The count stays exact either way.',
    remedy: caps.notifications
      ? 'Allow notifications, and keep the screen awake, to be alerted with Cook Mode in the background.'
      : 'Keep the screen on and Cook Mode in front.',
  };
}

/** The specific things that are missing, for the small print under the message. */
export function missingCapabilities(caps: CookCapabilities): readonly string[] {
  const missing: string[] = [];
  if (!caps.audio) missing.push('no Web Audio — no alarm tone');
  if (!caps.vibration) missing.push('no Vibration API — no buzz');
  if (!caps.wakeLock) missing.push('no Wake Lock — the screen may sleep on its own');
  if (!caps.notificationsGranted) missing.push('notifications not granted — nothing reaches you in the background');
  return missing;
}
