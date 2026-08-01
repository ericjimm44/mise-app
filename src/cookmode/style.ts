/**
 * Token → inline style helpers.
 *
 * Cook Mode reads colour and type straight from `@contract/tokens` rather than
 * through Tailwind class names. That is deliberate: this surface is the one
 * place in the app where a wrong colour is a safety problem (a doneness cue
 * that does not stand out is a doneness cue nobody reads), so the binding is
 * direct and greppable instead of routed through a generated class.
 *
 * No hex code appears in this directory. If it isn't in the contract, it isn't
 * a colour we use.
 */

import type { CSSProperties } from 'react';
import { cook, font, fontSize, motion, radius, rule, spacing } from '@contract/tokens';

export { cook, font, fontSize, motion, radius, rule, spacing };

type FontSizeKey = keyof typeof fontSize;

/** Expand a contract type-scale entry into inline styles. */
export function typeScale(key: FontSizeKey): CSSProperties {
  const [size, meta] = fontSize[key];
  const style: CSSProperties = { fontSize: size, lineHeight: meta.lineHeight };
  if ('letterSpacing' in meta) style.letterSpacing = meta.letterSpacing;
  return style;
}

/**
 * The floor for anything tappable in Cook Mode: `spacing.cookTap`, 4.5rem.
 * Hittable with a knuckle, the back of a wrist, or a finger you would rather
 * not put on a phone right now.
 */
export const tapTarget: CSSProperties = {
  minHeight: spacing.cookTap,
  minWidth: spacing.cookTap,
};

export const surface: CSSProperties = {
  backgroundColor: cook.base,
  color: cook.ink,
  fontFamily: font.sans.join(', '),
};

export const serif: CSSProperties = { fontFamily: font.serif.join(', ') };
export const mono: CSSProperties = {
  fontFamily: font.mono.join(', '),
  fontVariantNumeric: 'tabular-nums',
};

export function accentFor(type: 'active' | 'passive'): string {
  return type === 'active' ? cook.accent : cook.passive;
}

/**
 * Timers are the only thing that animates — `motion.timerPulse` is the one
 * permitted transition in the whole app. `prefers-reduced-motion` is honoured
 * globally in `src/index.css`, which flattens the duration; a countdown still
 * updates, it just stops pulsing.
 */
export const TIMER_PULSE_CSS = `
@keyframes mise-timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.mise-timer-pulse {
  animation: mise-timer-pulse ${motion.timerPulse} infinite;
}
`;
