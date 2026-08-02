/**
 * Degradation tests.
 *
 * The requirement is not "works everywhere" — it cannot. The requirement is
 * that Cook Mode never throws because a browser lacks an API, and never stays
 * quiet about it either. Both halves are asserted here: nothing below is
 * allowed to throw, and every degraded configuration must produce a message.
 *
 * The iOS Safari case is the one that matters — no `navigator.vibrate`, an
 * AudioContext that will not start without a gesture, no Wake Lock on older
 * versions — so it gets a host of its own.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  backgroundVerdict,
  detectCapabilities,
  missingCapabilities,
  type CapabilityHost,
} from './capabilities';
import { CookAlerts } from './alerts';

/** A browser with nothing at all. The floor. */
const BARE: CapabilityHost = { navigator: {} };

/** iOS Safari, roughly: audio exists, vibration does not, notifications unasked. */
const IOS_SAFARI: CapabilityHost = {
  AudioContext: function AudioContext() {} as unknown,
  navigator: { serviceWorker: {} },
  Notification: { permission: 'default' },
};

/** Chrome on Android with permission granted. Everything works. */
function fullyCapable(): CapabilityHost {
  return {
    AudioContext: function AudioContext() {} as unknown,
    navigator: { vibrate: () => true, wakeLock: { request: async () => ({ release: async () => {} }) }, serviceWorker: {} },
    Notification: { permission: 'granted' },
  };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

describe('detectCapabilities', () => {
  it('reports everything false on a browser with nothing', () => {
    expect(detectCapabilities(BARE)).toEqual({
      audio: false,
      vibration: false,
      wakeLock: false,
      serviceWorker: false,
      notifications: false,
      notificationsGranted: false,
    });
  });

  it('does not throw when navigator itself is absent', () => {
    expect(() => detectCapabilities({})).not.toThrow();
    expect(detectCapabilities({}).vibration).toBe(false);
  });

  it('sees no Vibration API on an iOS-shaped host', () => {
    const caps = detectCapabilities(IOS_SAFARI);
    expect(caps.vibration).toBe(false);
    expect(caps.wakeLock).toBe(false);
    expect(caps.audio).toBe(true);
    // The API exists but permission was never granted — not the same thing.
    expect(caps.notifications).toBe(true);
    expect(caps.notificationsGranted).toBe(false);
  });

  it('sees a fully capable host for what it is', () => {
    expect(detectCapabilities(fullyCapable())).toEqual({
      audio: true,
      vibration: true,
      wakeLock: true,
      serviceWorker: true,
      notifications: true,
      notificationsGranted: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Degrade VISIBLY — the honesty requirement
// ---------------------------------------------------------------------------

describe('background verdict', () => {
  it('stays silent only when a timer really can reach you with the screen off', () => {
    const verdict = backgroundVerdict(detectCapabilities(fullyCapable()));
    expect(verdict.reliability).toBe('reliable');
    expect(verdict.message).toBeNull();
  });

  it('says out loud that it can only alert you on screen', () => {
    const verdict = backgroundVerdict(detectCapabilities(IOS_SAFARI));
    expect(verdict.reliability).toBe('foreground_only');
    expect(verdict.message).not.toBeNull();
    expect(verdict.message).toMatch(/on screen/i);
    // And it draws the line in the right place: the alert is unreliable, the
    // count is not.
    expect(verdict.message).toMatch(/exact/i);
    expect(verdict.remedy).not.toBeNull();
  });

  it('admits outright when nothing will fire at all', () => {
    const verdict = backgroundVerdict(detectCapabilities(BARE));
    expect(verdict.reliability).toBe('none');
    expect(verdict.message).toMatch(/nothing will alert you/i);
    expect(verdict.message).toMatch(/exact time/i);
  });

  it('never leaves a degraded device without a message', () => {
    // Every configuration short of fully-capable must say something. A timer
    // that fails quietly is worse than one that admits it can't fire.
    const degraded: CapabilityHost[] = [
      BARE,
      {},
      IOS_SAFARI,
      { AudioContext: function A() {} as unknown, navigator: {} },
      { navigator: { vibrate: () => true } },
      { navigator: { serviceWorker: {} }, Notification: { permission: 'denied' } },
    ];
    for (const host of degraded) {
      const verdict = backgroundVerdict(detectCapabilities(host));
      expect(verdict.reliability).not.toBe('reliable');
      expect(verdict.message, JSON.stringify(host)).not.toBeNull();
      expect(verdict.message?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('names the specific things that are missing', () => {
    const missing = missingCapabilities(detectCapabilities(IOS_SAFARI));
    expect(missing.join(' ')).toMatch(/Vibration API/);
    expect(missing.join(' ')).toMatch(/Wake Lock/);
    expect(missingCapabilities(detectCapabilities(fullyCapable()))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Degrade WITHOUT THROWING
// ---------------------------------------------------------------------------

describe('CookAlerts on a browser missing everything', () => {
  it('constructs, unlocks, fires and disposes without throwing', async () => {
    const alerts = new CookAlerts(BARE);
    expect(() => alerts.unlock()).not.toThrow();
    expect(alerts.audioReady).toBe(false);

    const outcome = alerts.fire('active', 'Sear the thighs');
    expect(outcome).toEqual({ audio: false, vibration: false, notification: false });

    await expect(alerts.requestWakeLock()).resolves.toBe(false);
    await expect(alerts.releaseWakeLock()).resolves.toBeUndefined();
    await expect(alerts.requestNotificationPermission()).resolves.toBe(false);
    await expect(alerts.dispose()).resolves.toBeUndefined();
  });

  it('survives a host with no navigator at all', async () => {
    const alerts = new CookAlerts({});
    expect(() => alerts.fire('passive', 'Rest the thighs')).not.toThrow();
    await expect(alerts.requestWakeLock()).resolves.toBe(false);
  });

  it('missing navigator.vibrate does not stop the other channels', () => {
    const buzzless: CapabilityHost = { navigator: { serviceWorker: {} } };
    const alerts = new CookAlerts(buzzless);
    expect(alerts.fire('active', 'Sear').vibration).toBe(false);
    expect(alerts.capabilities.vibration).toBe(false);
  });

  it('missing navigator.wakeLock resolves false rather than rejecting', async () => {
    const alerts = new CookAlerts({ navigator: {} });
    await expect(alerts.requestWakeLock()).resolves.toBe(false);
    // Releasing a lock we never held is a no-op, not an error.
    await expect(alerts.releaseWakeLock()).resolves.toBeUndefined();
  });

  it('a wake lock that is refused is a fact, not an exception', async () => {
    const alerts = new CookAlerts({
      navigator: {
        wakeLock: {
          request: () => Promise.reject(new Error('NotAllowedError: document hidden')),
        },
      },
    });
    await expect(alerts.requestWakeLock()).resolves.toBe(false);
  });

  it('an AudioContext that refuses to construct is caught', () => {
    const alerts = new CookAlerts({
      AudioContext: function Broken() {
        throw new Error('not allowed');
      } as unknown,
      navigator: {},
    });
    expect(() => alerts.unlock()).not.toThrow();
    expect(alerts.audioReady).toBe(false);
    expect(() => alerts.fire('active', 'Sear')).not.toThrow();
  });

  it('a vibrate that throws does not take the alert down with it', () => {
    const alerts = new CookAlerts({
      navigator: {
        vibrate: () => {
          throw new Error('blocked by user gesture policy');
        },
      },
    });
    const outcome = alerts.fire('active', 'Sear');
    expect(outcome.vibration).toBe(false);
  });
});

describe('CookAlerts when the platform cooperates', () => {
  it('vibrates with a pattern that distinguishes active from passive', () => {
    const vibrate = vi.fn(() => true);
    const alerts = new CookAlerts({ navigator: { vibrate } });

    expect(alerts.fire('active', 'Sear').vibration).toBe(true);
    expect(alerts.fire('passive', 'Rest').vibration).toBe(true);

    const [activePattern] = vibrate.mock.calls[0] as unknown as [readonly number[]];
    const [passivePattern] = vibrate.mock.calls[1] as unknown as [readonly number[]];
    expect(activePattern).not.toEqual(passivePattern);
  });

  it('reaches a locked phone through the service worker when permission is granted', async () => {
    const showNotification = vi.fn(async (_title: string, _options: unknown) => {});
    const alerts = new CookAlerts({
      navigator: { serviceWorker: { ready: Promise.resolve({ showNotification }) } },
      Notification: { permission: 'granted' },
    });

    expect(alerts.fire('active', 'Sear the thighs').notification).toBe(true);
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledOnce());
    // The tray label is the notification title — it must identify the step.
    expect(showNotification.mock.calls[0]?.[0]).toBe('Sear the thighs');
  });

  it('does not try to notify when permission was never granted', () => {
    const showNotification = vi.fn(async () => {});
    const alerts = new CookAlerts({
      navigator: { serviceWorker: { ready: Promise.resolve({ showNotification }) } },
      Notification: { permission: 'default' },
    });
    expect(alerts.fire('active', 'Sear').notification).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('holds and releases a wake lock', async () => {
    const release = vi.fn(async () => {});
    const alerts = new CookAlerts({
      navigator: { wakeLock: { request: async (kind: string) => ({ kind, release }) } },
    });
    await expect(alerts.requestWakeLock()).resolves.toBe(true);
    await alerts.releaseWakeLock();
    expect(release).toHaveBeenCalledOnce();
  });

  it('plays a tone once the context is unlocked by a gesture', () => {
    const started: number[] = [];
    const audioParam = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const ctx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: () => ({
        type: '',
        frequency: audioParam(),
        connect: vi.fn(),
        start: (at: number) => started.push(at),
        stop: vi.fn(),
      }),
      createGain: () => ({ gain: audioParam(), connect: vi.fn() }),
      resume: async () => {},
      close: async () => {},
    };
    const alerts = new CookAlerts({
      AudioContext: function AudioContext(this: unknown) {
        return ctx;
      } as unknown,
      navigator: {},
    });

    alerts.unlock();
    expect(alerts.audioReady).toBe(true);
    expect(alerts.fire('active', 'Sear').audio).toBe(true);
    // Three beeps for an active step, spaced rather than stacked.
    expect(started).toHaveLength(3);
    expect(new Set(started).size).toBe(3);
  });
});
