/**
 * Generation constants. Pinned deliberately — these are the settings that cause
 * silent 400s or silent truncation when they drift.
 */

/**
 * Exact model ID. No date suffix, no alias games.
 */
export const MODEL = 'claude-opus-5' as const;

/**
 * Caps thinking PLUS response text together. A long Project-tier recipe with
 * adaptive thinking can run close to this ceiling. If `stop_reason` comes back
 * `max_tokens`, raise this and switch to streaming rather than trimming the
 * schema — the schema is the product.
 *
 * 16000 keeps a non-streaming request below the SDK's HTTP timeout threshold.
 */
export const MAX_TOKENS = 16000;

/**
 * Default attempts before giving up. Capped on purpose: an unbounded
 * regeneration loop with a client-side API key is a way to spend real money on
 * a broken prompt.
 */
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Never set `temperature`, `top_p` or `top_k` on this model — they were removed
 * and any value returns a 400. Never send `thinking`: on Claude Opus 5 thinking
 * is on by default and omitting the field runs adaptive. Never prefill the
 * assistant turn — structured outputs replace it, and a prefill returns a 400.
 *
 * This constant exists so the rule is greppable and testable, not just a comment.
 */
export const FORBIDDEN_REQUEST_FIELDS: readonly string[] = [
  'temperature',
  'top_p',
  'top_k',
  'thinking',
];
