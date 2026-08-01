/**
 * CONTRACT — design tokens. Frozen. No agent may edit this file.
 *
 * Aesthetic: Japanese minimalist, Muji-adjacent. A cookbook, not a dashboard.
 *
 * This module is the single source of truth for colour, type and spacing.
 * `tailwind.config.ts` imports it directly, so Tailwind utility classes
 * (`bg-paper`, `text-charcoal`, `font-serif`) are generated FROM these values.
 * Never hardcode a hex code in a component — if it isn't here, it isn't a colour
 * we use.
 *
 * Rules encoded below, not left to taste:
 *   - No gradients. No purple SaaS glow. No card shadows.
 *   - Whitespace separates content; hairline rules do the little that's left.
 *   - Cook mode inverts to dark, large type, readable across a kitchen.
 *   - Timers are the only thing that animates.
 */

/** Light surface — the cookbook page. */
export const paper = {
  /** Base page. Warm off-white, never pure #FFF. */
  DEFAULT: '#F7F5F1',
  /** Slightly recessed areas — inputs, inactive tabs. */
  sunken: '#EFEDE8',
  /** Raised areas. Used sparingly; whitespace is preferred over containers. */
  raised: '#FCFBF9',
} as const;

/** Ink. Charcoal, never pure black — pure black on warm paper reads as a hole. */
export const ink = {
  DEFAULT: '#1C1C1A',
  /** Body copy at length. */
  soft: '#3D3D39',
  /** Secondary information — timings, units, counts. */
  muted: '#6B6B65',
  /** Placeholder and disabled. Fails contrast for body text by design; never use for content. */
  faint: '#9C9C95',
} as const;

/**
 * ONE restrained accent. Burnt orange — the colour of a good sear, which is
 * the whole point of the product. Used for: active timer, primary action,
 * technique-owned state. Nothing else earns it.
 */
export const accent = {
  DEFAULT: '#B4531F',
  /** Hover / pressed. */
  deep: '#8F3F16',
  /** Tinted background wash — technique chips, active step marker. */
  wash: '#F3E7DE',
} as const;

/**
 * Semantic colours. Deliberately desaturated so nothing shouts.
 * `danger` is for the "I'm behind" state and failure modes — it must read as
 * serious without looking like a browser error dialog.
 */
export const semantic = {
  danger: '#8C2F27',
  dangerWash: '#F5E3E1',
  /** Passive time — resting, marinating, proving. Cooler, calmer than accent. */
  passive: '#3C5A6E',
  passiveWash: '#E3EAEF',
  /** A technique the user owns. */
  owned: '#4A6141',
  ownedWash: '#E6ECE2',
} as const;

/** Hairlines. 1px, low opacity — never a border that draws attention to itself. */
export const rule = {
  /** Standard divider. */
  DEFAULT: 'rgba(28, 28, 26, 0.10)',
  /** Stronger, for structural separation only. */
  strong: 'rgba(28, 28, 26, 0.18)',
  /** On the dark cook-mode surface. */
  inverse: 'rgba(247, 245, 241, 0.14)',
} as const;

/**
 * COOK MODE — inverted. This is not "dark mode"; it is a different room.
 * Read from across a kitchen, at an angle, with wet hands and no glasses.
 * Contrast is maximised deliberately: this palette breaks the restraint of the
 * rest of the app because legibility beats taste when a pan is hot.
 */
export const cook = {
  /** Near-black base. Slight warmth so it isn't clinical. */
  base: '#14140F',
  /** Raised step card. */
  raised: '#20201A',
  /** Primary text — bright, high contrast. */
  ink: '#F7F5F1',
  /** Secondary text. */
  inkMuted: '#A8A79F',
  /** Active timer / current step. Brighter than the light-mode accent to survive glare. */
  accent: '#E4762F',
  /** Passive timer. */
  passive: '#6E9CBC',
  /** Doneness cue — the thing that's actually true. Gets its own colour. */
  cue: '#C6D6A8',
  /** Failure mode warning. */
  warn: '#E0A03C',
} as const;

/**
 * Type. Serif for recipe titles and step headers — it's a cookbook.
 * Clean sans for UI chrome. Generous line height throughout.
 *
 * Both stacks are system-font-first: a local-first offline app must not block
 * first paint on a webfont, and a kitchen has no signal.
 */
export const font = {
  serif: [
    'Iowan Old Style',
    'Palatino Linotype',
    'Palatino',
    'Charter',
    'Georgia',
    'ui-serif',
    'serif',
  ],
  sans: [
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ],
  /** Timers and quantities. Tabular figures so digits don't jitter as they count down. */
  mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
} as const;

/**
 * Type scale. `cook*` sizes are for Cook Mode only and are deliberately huge —
 * the step instruction is read standing up, two feet back from a phone on a counter.
 */
export const fontSize = {
  micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
  small: ['0.8125rem', { lineHeight: '1.25rem' }],
  body: ['1rem', { lineHeight: '1.7' }],
  lead: ['1.125rem', { lineHeight: '1.7' }],
  title: ['1.5rem', { lineHeight: '1.3' }],
  display: ['2rem', { lineHeight: '1.2' }],
  hero: ['2.75rem', { lineHeight: '1.1' }],
  cookBody: ['1.5rem', { lineHeight: '1.55' }],
  cookTitle: ['2.25rem', { lineHeight: '1.2' }],
  cookTimer: ['4rem', { lineHeight: '1' }],
} as const;

/** Spacing. A 4px base; the large end exists because whitespace is the design. */
export const spacing = {
  gutter: '1.25rem',
  section: '3rem',
  /** Minimum tap target. Cook Mode targets must not go below this — see `cookTap`. */
  tap: '2.75rem',
  /** Cook Mode tap target: hittable with a knuckle or a wrist. */
  cookTap: '4.5rem',
} as const;

/** Corner radius. Soft, but not rounded enough to read as a "card UI". */
export const radius = {
  sm: '0.1875rem',
  DEFAULT: '0.375rem',
  lg: '0.75rem',
  full: '9999px',
} as const;

/**
 * Motion. Timers are the only thing that animates — everything else is instant.
 * `reduce` is honoured globally; a countdown still updates, it just doesn't pulse.
 */
export const motion = {
  /** The single permitted transition, for timer state changes only. */
  timerPulse: '1200ms cubic-bezier(0.4, 0, 0.6, 1)',
  /** Instant, for everything that is not a timer. */
  instant: '0ms',
} as const;

/** Everything, for consumers that want the whole palette in one object. */
export const tokens = {
  paper,
  ink,
  accent,
  semantic,
  rule,
  cook,
  font,
  fontSize,
  spacing,
  radius,
  motion,
} as const;

export type Tokens = typeof tokens;
