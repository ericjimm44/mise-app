import type { Config } from 'tailwindcss';
import { tokens } from './src/contract/tokens';

/**
 * Tailwind derives its theme FROM the contract. `src/contract/tokens.ts` is the
 * single source of truth — this file only translates it into utility classes.
 * Do not add a colour here that does not exist there.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: tokens.paper,
        ink: tokens.ink,
        accent: tokens.accent,
        danger: { DEFAULT: tokens.semantic.danger, wash: tokens.semantic.dangerWash },
        passive: { DEFAULT: tokens.semantic.passive, wash: tokens.semantic.passiveWash },
        owned: { DEFAULT: tokens.semantic.owned, wash: tokens.semantic.ownedWash },
        cook: tokens.cook,
      },
      borderColor: {
        rule: tokens.rule.DEFAULT,
        'rule-strong': tokens.rule.strong,
        'rule-inverse': tokens.rule.inverse,
      },
      fontFamily: {
        serif: [...tokens.font.serif],
        sans: [...tokens.font.sans],
        mono: [...tokens.font.mono],
      },
      fontSize: tokens.fontSize as unknown as Record<string, [string, Record<string, string>]>,
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      // Deliberately minimal: no shadow scale. Whitespace over borders,
      // hairlines over cards, and never a drop shadow.
      boxShadow: {
        none: 'none',
      },
    },
  },
  plugins: [],
} satisfies Config;
