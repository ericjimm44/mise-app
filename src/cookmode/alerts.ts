/**
 * Sound, haptics and wake lock — every one of them optional, none of them
 * allowed to throw.
 *
 * Everything in here is best-effort and feature-detected at the point of use,
 * not at import time: an environment that has `AudioContext` may still refuse
 * to start it, and a wake lock that was granted is silently released the moment
 * the tab hides. The class never rejects, never throws, and reports what it
 * actually managed to do so `capabilities.ts` can tell the truth about it.
 *
 * What it does NOT do is pretend. If `navigator.vibrate` is absent — which is
 * every iOS browser — `fire()` simply does not buzz, `capabilities.vibration`
 * is false, and Cook Mode says so on screen.
 */

import type { TimerType } from '@contract/types';
import { detectCapabilities, type CapabilityHost, type CookCapabilities } from './capabilities';

interface MinimalAudioParam {
  value: number;
  setValueAtTime(value: number, when: number): void;
  exponentialRampToValueAtTime(value: number, when: number): void;
}
interface MinimalGain {
  gain: MinimalAudioParam;
  connect(destination: unknown): void;
}
interface MinimalOscillator {
  type: string;
  frequency: MinimalAudioParam;
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}
interface MinimalAudioContext {
  state: string;
  currentTime: number;
  destination: unknown;
  createOscillator(): MinimalOscillator;
  createGain(): MinimalGain;
  resume(): Promise<void>;
  close(): Promise<void>;
}

type AudioContextCtor = new () => MinimalAudioContext;

export interface AlertOutcome {
  audio: boolean;
  vibration: boolean;
  notification: boolean;
}

/**
 * Distinct signatures so the cook can tell, without looking, which pan just
 * called. Active steps get the urgent one.
 */
const PATTERNS: Record<TimerType, { beeps: number; hz: number; buzz: readonly number[] }> = {
  active: { beeps: 3, hz: 880, buzz: [200, 100, 200, 100, 200] },
  passive: { beeps: 2, hz: 587, buzz: [400, 150, 400] },
};

export class CookAlerts {
  private readonly host: CapabilityHost;
  private ctx: MinimalAudioContext | null = null;
  private wakeLockSentinel: { release(): Promise<void>; released?: boolean } | null = null;

  /** Refreshed on `unlock()` and on every wake-lock attempt. */
  public capabilities: CookCapabilities;

  constructor(host: CapabilityHost = globalThis as unknown as CapabilityHost) {
    this.host = host;
    this.capabilities = detectCapabilities(host);
  }

  /**
   * Call from inside a real user gesture — the first tap on the Cook Mode
   * surface. iOS Safari will not let an AudioContext produce a sound that was
   * not, somewhere up the stack, caused by a finger. Holding the reference
   * afterwards is what lets a timer beep twenty minutes later.
   */
  unlock(): void {
    this.capabilities = detectCapabilities(this.host);
    if (this.ctx !== null) {
      void this.safeResume(this.ctx);
      return;
    }
    const Ctor = (this.host.AudioContext ?? this.host.webkitAudioContext) as
      | AudioContextCtor
      | undefined;
    if (typeof Ctor !== 'function') return;
    try {
      this.ctx = new Ctor();
      void this.safeResume(this.ctx);
    } catch {
      this.ctx = null;
    }
  }

  /** True when an AudioContext exists and is not suspended. */
  get audioReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Fire every channel we have. Returns what actually happened, so the caller
   * can record that a timer went off unheard rather than assume it was heard.
   */
  fire(type: TimerType, label: string): AlertOutcome {
    return {
      audio: this.beep(type),
      vibration: this.buzz(type),
      notification: this.notify(type, label),
    };
  }

  private beep(type: TimerType): boolean {
    const ctx = this.ctx;
    if (ctx === null) return false;
    const pattern = PATTERNS[type];
    try {
      if (ctx.state === 'suspended') void this.safeResume(ctx);
      for (let i = 0; i < pattern.beeps; i++) {
        const at = ctx.currentTime + i * 0.28;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pattern.hz, at);
        // Ramp down rather than hard-stop: a clipped square edge reads as a
        // glitch, and this alarm has to survive an extractor fan.
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.24);
      }
      return true;
    } catch {
      return false;
    }
  }

  private buzz(type: TimerType): boolean {
    const vibrate = this.host.navigator?.vibrate;
    if (typeof vibrate !== 'function') return false;
    try {
      // .call so the detected function keeps its receiver.
      (vibrate as (p: readonly number[]) => boolean).call(
        this.host.navigator,
        PATTERNS[type].buzz,
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The only channel that can reach a locked phone. Goes through the service
   * worker registration when there is one, because a page-level `new
   * Notification()` is not permitted on mobile.
   */
  private notify(type: TimerType, label: string): boolean {
    if (this.host.Notification?.permission !== 'granted') return false;
    const sw = this.host.navigator?.serviceWorker as
      | { ready?: Promise<{ showNotification?: (t: string, o: unknown) => Promise<void> }> }
      | undefined;
    if (sw?.ready === undefined) return false;
    try {
      void sw.ready
        .then((registration) => {
          void registration.showNotification?.(label, {
            body: type === 'active' ? 'Needs you now.' : 'Time is up — check the cue.',
            tag: `mise-timer-${label}`,
            renotify: true,
            requireInteraction: type === 'active',
            silent: false,
          });
        })
        .catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hold the screen awake while Cook Mode is open. The lock is dropped by the
   * browser whenever the page hides, so this must be called again on every
   * `visibilitychange` back to visible — see `useCookSession`.
   */
  async requestWakeLock(): Promise<boolean> {
    const wakeLock = this.host.navigator?.wakeLock as
      | { request?: (kind: string) => Promise<{ release(): Promise<void> }> }
      | undefined;
    this.capabilities = detectCapabilities(this.host);
    if (wakeLock?.request === undefined) return false;
    try {
      this.wakeLockSentinel = await wakeLock.request('screen');
      return true;
    } catch {
      // Denied, or the document was not visible. Not an error — a fact.
      this.wakeLockSentinel = null;
      return false;
    }
  }

  async releaseWakeLock(): Promise<void> {
    const sentinel = this.wakeLockSentinel;
    this.wakeLockSentinel = null;
    if (sentinel === null) return;
    try {
      await sentinel.release();
    } catch {
      /* already gone */
    }
  }

  /** Ask once, from a gesture. Never blocks, never throws, never retries. */
  async requestNotificationPermission(): Promise<boolean> {
    const Notif = this.host.Notification as
      | { permission?: string; requestPermission?: () => Promise<string> }
      | undefined;
    if (Notif?.requestPermission === undefined) return false;
    try {
      const result = await Notif.requestPermission();
      this.capabilities = detectCapabilities(this.host);
      return result === 'granted';
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    await this.releaseWakeLock();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx === null) return;
    try {
      await ctx.close();
    } catch {
      /* nothing to close */
    }
  }

  private async safeResume(ctx: MinimalAudioContext): Promise<void> {
    try {
      await ctx.resume();
    } catch {
      /* suspended until a gesture we haven't had yet */
    }
  }
}
