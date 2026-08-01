/**
 * INGREDIENT SOURCES — the seam that makes photo capture cheap later.
 *
 * There are two halves to getting food into the app, and they are deliberately
 * separated:
 *
 *   1. A SOURCE produces candidate ingredient names. It stores nothing.
 *   2. CONFIRMATION turns confirmed candidates into inventory drafts, which the
 *      repository writes.
 *
 * Manual typing is one source. Photo capture will be another — same interface,
 * same confirmation screen, no refactor. That is the entire reason this boundary
 * exists, so nothing downstream of `propose()` may ever assume a human typed it.
 *
 * Confirmation is NOT optional for manual entry. Skipping it "because the user
 * obviously meant what they typed" is how the seam rots: by the time photo
 * capture arrives, the confirm step no longer exists to reuse.
 */

import type { IngredientCategory } from '@contract/types';
import { inferCategory } from './catalog';
import type { InventoryDraft } from './storage';
import { deriveNormalized } from './storage';

export type IngredientSourceId = 'manual' | 'photo';

/**
 * A proposed ingredient, not yet stored. Note the absence of `normalized` — a
 * candidate has no matching key because it is not yet an inventory item, and
 * deriving one before confirmation would invite a code path that stores it.
 */
export interface IngredientCandidate {
  /** Stable within one proposal round, for list keys and toggling. */
  key: string;
  name: string;
  quantity?: string;
  category?: IngredientCategory;
  /**
   * 0–1. Manual entry is always 1. A photo source reports what its recogniser
   * believed, so the confirm screen can sort the doubtful ones to the top.
   */
  confidence: number;
  source: IngredientSourceId;
}

export interface IngredientSource<TInput> {
  id: IngredientSourceId;
  label: string;
  /** Returns candidates for the user to confirm. Never writes. */
  propose(input: TInput): Promise<readonly IngredientCandidate[]>;
}

// ---------------------------------------------------------------------------
// Manual source
// ---------------------------------------------------------------------------

/** "2 chicken thighs" → quantity "2", name "chicken thighs". */
const LEADING_QUANTITY =
  /^\s*((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:kg|g|grams?|lbs?|lb|oz|ml|l|litres?|liters?|tbsp|tsp|cups?|cloves?|bunch(?:es)?|tins?|cans?|packs?|punnets?|jars?|bottles?|slices?|sprigs?|heads?|x)?)\s+(.+)$/i;

export function parseQuantity(raw: string): { quantity?: string; name: string } {
  const trimmed = raw.trim();
  const match = LEADING_QUANTITY.exec(trimmed);
  if (!match) return { name: trimmed };
  const quantity = match[1]?.trim();
  const name = match[2]?.trim();
  if (!quantity || !name) return { name: trimmed };
  return { quantity, name };
}

/**
 * Split a typed line into separate ingredients. Commas, newlines, semicolons and
 * a trailing "and" all count — people type "eggs, milk and butter" and expect
 * three items.
 */
export function splitEntry(raw: string): string[] {
  return raw
    .split(/[\n,;]+|\s+&\s+|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function toCandidate(raw: string, index: number, source: IngredientSourceId): IngredientCandidate | null {
  const { quantity, name } = parseQuantity(raw);
  if (deriveNormalized(name).length === 0) return null;
  const category = inferCategory(name);
  return {
    key: `${source}:${index}:${deriveNormalized(name)}`,
    name,
    confidence: 1,
    source,
    ...(quantity ? { quantity } : {}),
    ...(category ? { category } : {}),
  };
}

/**
 * Typed text in, candidates out. Synchronous work behind an async interface on
 * purpose: the photo source will be genuinely async, and callers should already
 * be awaiting.
 */
export const manualIngredientSource: IngredientSource<string> = {
  id: 'manual',
  label: 'Type it',
  async propose(input: string): Promise<readonly IngredientCandidate[]> {
    const seen = new Set<string>();
    const out: IngredientCandidate[] = [];
    splitEntry(input).forEach((part, index) => {
      const candidate = toCandidate(part, index, 'manual');
      if (!candidate) return;
      const key = deriveNormalized(candidate.name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(candidate);
    });
    return out;
  },
};

// ---------------------------------------------------------------------------
// Confirmation — the only path from candidate to stored item
// ---------------------------------------------------------------------------

/**
 * Turn confirmed candidates into repository drafts.
 *
 * `normalized` is deliberately NOT set here. The repository derives it with
 * `deriveNormalized()`, which is `normalize()` from the contract, so there is
 * one derivation in the codebase and no opportunity for a caller to hand-write
 * a matching key.
 */
export function candidatesToDrafts(
  candidates: readonly IngredientCandidate[],
): InventoryDraft[] {
  return candidates.map((c) => ({
    name: c.name,
    ...(c.quantity ? { quantity: c.quantity } : {}),
    ...(c.category ? { category: c.category } : {}),
  }));
}

/**
 * Registry of sources, so the entry UI can offer whatever exists without
 * knowing what that is. Photo capture registers here and appears in the UI —
 * that is the whole cost of adding it.
 */
export const INGREDIENT_SOURCES: readonly IngredientSource<never>[] = [
  manualIngredientSource as unknown as IngredientSource<never>,
];
