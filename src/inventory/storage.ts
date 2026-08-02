/**
 * THE STORAGE BOUNDARY.
 *
 * Agent D owns persistence. This file exists because inventory merges before D,
 * so the repository D will eventually provide does not exist yet. Every Dexie
 * call this module makes lives in `DexieInventoryRepository` below and nowhere
 * else — no component, hook or test reaches for `db.inventory.put()` directly.
 *
 * When D lands, reconciliation is: point `InventoryRepository` at D's
 * implementation and delete `DexieInventoryRepository`. Nothing else moves.
 *
 * Tables owned here: `inventory`, `pantryStaples`, `exclusions`, `settings`.
 * `savedRecipes`, `cookLogs`, `techniqueProgress` and `calibration` are D's and
 * are never touched from this module.
 */

import { MiseDatabase, SINGLETON_ID, db as defaultDb } from '@contract/db';
import { DEFAULT_EXCLUSIONS, containsTerm, normalize } from '@contract/recipe.schema';
import type {
  Exclusion,
  IngredientCategory,
  InventoryItem,
  PantryStaple,
  UserSettings,
} from '@contract/types';
import { DEFAULT_PANTRY_STAPLES, DEFAULT_SETTINGS, SETTINGS_BOUNDS } from './defaults';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * What a caller may supply when adding inventory.
 *
 * `normalized` is absent on purpose: it is derived, never user-typed
 * (`InventoryItem` in the contract says so). The only place it is computed is
 * `deriveNormalized()` below, which is `normalize()` from the contract and
 * nothing else.
 */
export interface InventoryDraft {
  name: string;
  quantity?: string;
  category?: IngredientCategory;
}

export interface CustomExclusionDraft {
  label: string;
  terms: readonly string[];
}

export type SettingsPatch = Partial<Omit<UserSettings, 'id'>>;

// ---------------------------------------------------------------------------
// Derivation — the one function that may produce `normalized`
// ---------------------------------------------------------------------------

/**
 * Derive the matching key for an inventory item, staple or exclusion term.
 *
 * This is `normalize()` from `@contract/recipe.schema`, re-exported through one
 * named function so there is exactly one call site to audit. It must never
 * become "normalize plus a bit" — the validator matches recipes against these
 * strings with the same function, and the moment the two drift, Rule 1 starts
 * rejecting recipes for ingredients the user actually has. A test asserts
 * equality with `normalize()` directly so drift fails the build.
 */
export function deriveNormalized(name: string): string {
  return normalize(name);
}

// ---------------------------------------------------------------------------
// The interface Agent D will satisfy
// ---------------------------------------------------------------------------

export interface InventoryRepository {
  /** Idempotent first-run seeding of exclusions, staples and settings. */
  ensureSeeded(): Promise<void>;

  // --- inventory
  listInventory(): Promise<InventoryItem[]>;
  /** Adds, deriving `normalized`. Existing items with the same key are updated, not duplicated. */
  addInventoryItems(drafts: readonly InventoryDraft[]): Promise<InventoryItem[]>;
  updateInventoryItem(id: string, patch: Partial<InventoryDraft>): Promise<void>;
  removeInventoryItem(id: string): Promise<void>;
  clearInventory(): Promise<void>;

  // --- pantry staples
  listPantryStaples(): Promise<PantryStaple[]>;
  setPantryStapleEnabled(id: string, enabled: boolean): Promise<void>;
  addCustomPantryStaple(name: string): Promise<PantryStaple | null>;
  removePantryStaple(id: string): Promise<void>;

  // --- exclusions
  listExclusions(): Promise<Exclusion[]>;
  setExclusionEnabled(id: string, enabled: boolean): Promise<void>;
  addCustomExclusion(draft: CustomExclusionDraft): Promise<Exclusion>;
  updateExclusionTerms(id: string, terms: readonly string[]): Promise<void>;
  removeCustomExclusion(id: string): Promise<void>;

  // --- settings (singleton row keyed 'singleton')
  getSettings(): Promise<UserSettings>;
  updateSettings(patch: SettingsPatch): Promise<UserSettings>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  const cryptoObj: Crypto | undefined = globalThis.crypto;
  const suffix =
    cryptoObj && typeof cryptoObj.randomUUID === 'function'
      ? cryptoObj.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${suffix}`;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Strip a leading article so "a lemon" and "lemon" are one item. */
function cleanName(raw: string): string {
  return raw.trim().replace(/^(a|an|the|some)\s+/i, '').trim();
}

/**
 * True when a pantry staple would violate an active exclusion.
 *
 * Uses `containsTerm()` from the contract — the same matcher the validator runs
 * — so what counts as a conflict here is what will count as a violation there.
 */
export function stapleViolatesExclusions(
  staple: Pick<PantryStaple, 'name'>,
  exclusions: readonly Exclusion[],
): Exclusion | null {
  for (const exclusion of exclusions) {
    if (!exclusion.enabled) continue;
    for (const term of exclusion.terms) {
      if (containsTerm(staple.name, term)) return exclusion;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dexie implementation — the only place in `src/inventory/` that touches Dexie
// ---------------------------------------------------------------------------

export class DexieInventoryRepository implements InventoryRepository {
  constructor(private readonly db: MiseDatabase = defaultDb) {}

  // --- seeding ------------------------------------------------------------

  /**
   * First run only. The contract constants are the SEED; the table is the
   * runtime source of truth from here on. A user who unticks Seafood must stay
   * unticked, so this never re-applies over a populated table.
   */
  async ensureSeeded(): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.exclusions,
      this.db.pantryStaples,
      this.db.settings,
      async () => {
        if ((await this.db.exclusions.count()) === 0) {
          await this.db.exclusions.bulkPut(
            DEFAULT_EXCLUSIONS.map((e) => ({ ...e, terms: [...e.terms] })),
          );
        }
        if ((await this.db.pantryStaples.count()) === 0) {
          await this.db.pantryStaples.bulkPut(DEFAULT_PANTRY_STAPLES.map((s) => ({ ...s })));
        }
        const existing = await this.db.settings.get(SINGLETON_ID);
        if (!existing) {
          await this.db.settings.put({ ...DEFAULT_SETTINGS });
        }
      },
    );
  }

  // --- inventory ----------------------------------------------------------

  async listInventory(): Promise<InventoryItem[]> {
    const items = await this.db.inventory.toArray();
    return items.sort((a, b) => b.addedAt - a.addedAt);
  }

  async addInventoryItems(drafts: readonly InventoryDraft[]): Promise<InventoryItem[]> {
    if (drafts.length === 0) return [];

    return this.db.transaction('rw', this.db.inventory, async () => {
      const existing = await this.db.inventory.toArray();
      const byKey = new Map<string, InventoryItem>();
      for (const item of existing) byKey.set(item.normalized, item);

      const written: InventoryItem[] = [];
      const now = Date.now();

      for (const draft of drafts) {
        const name = cleanName(draft.name);
        const normalized = deriveNormalized(name);
        if (!normalized) continue; // punctuation-only input is not an ingredient

        const prior = byKey.get(normalized);
        const item: InventoryItem = {
          id: prior?.id ?? newId('inv'),
          name: prior ? prior.name : name,
          normalized,
          addedAt: prior?.addedAt ?? now,
          ...quantityOf(draft, prior),
          ...categoryOf(draft, prior),
        };
        byKey.set(normalized, item);
        written.push(item);
      }

      await this.db.inventory.bulkPut(written);
      return written;
    });
  }

  async updateInventoryItem(id: string, patch: Partial<InventoryDraft>): Promise<void> {
    await this.db.transaction('rw', this.db.inventory, async () => {
      const current = await this.db.inventory.get(id);
      if (!current) return;

      const name = patch.name === undefined ? current.name : cleanName(patch.name);
      const normalized = deriveNormalized(name);
      if (!normalized) return;

      const next: InventoryItem = {
        id: current.id,
        name,
        normalized,
        addedAt: current.addedAt,
        ...quantityOf({ name, ...patch }, current),
        ...categoryOf({ name, ...patch }, current),
      };
      await this.db.inventory.put(next);
    });
  }

  async removeInventoryItem(id: string): Promise<void> {
    await this.db.inventory.delete(id);
  }

  async clearInventory(): Promise<void> {
    await this.db.inventory.clear();
  }

  // --- pantry staples -----------------------------------------------------

  async listPantryStaples(): Promise<PantryStaple[]> {
    return this.db.pantryStaples.toArray();
  }

  async setPantryStapleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.transaction('rw', this.db.pantryStaples, async () => {
      const current = await this.db.pantryStaples.get(id);
      if (!current) return;
      await this.db.pantryStaples.put({ ...current, enabled });
    });
  }

  async addCustomPantryStaple(name: string): Promise<PantryStaple | null> {
    const clean = cleanName(name);
    const normalized = deriveNormalized(clean);
    if (!normalized) return null;

    return this.db.transaction('rw', this.db.pantryStaples, async () => {
      const existing = await this.db.pantryStaples
        .where('normalized')
        .equals(normalized)
        .first();
      if (existing) {
        const enabled: PantryStaple = { ...existing, enabled: true };
        await this.db.pantryStaples.put(enabled);
        return enabled;
      }
      const staple: PantryStaple = {
        id: newId('staple'),
        name: clean,
        normalized,
        enabled: true,
      };
      await this.db.pantryStaples.put(staple);
      return staple;
    });
  }

  async removePantryStaple(id: string): Promise<void> {
    await this.db.pantryStaples.delete(id);
  }

  // --- exclusions ---------------------------------------------------------

  async listExclusions(): Promise<Exclusion[]> {
    const rows = await this.db.exclusions.toArray();
    // Seeded set first, in seed order; custom exclusions after, alphabetically.
    const seedOrder = new Map(DEFAULT_EXCLUSIONS.map((e, i) => [e.id, i]));
    return rows.sort((a, b) => {
      const ai = seedOrder.get(a.id);
      const bi = seedOrder.get(b.id);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Toggling an exclusion on also switches off any pantry staple it would
   * forbid. Without this, "no dairy" leaves Butter sitting in the always-
   * available list, and every generation burns an attempt on a recipe the
   * validator then throws away.
   */
  async setExclusionEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.transaction('rw', this.db.exclusions, this.db.pantryStaples, async () => {
      const current = await this.db.exclusions.get(id);
      if (!current) return;
      const next: Exclusion = { ...current, enabled };
      await this.db.exclusions.put(next);
      if (!enabled) return;

      const staples = await this.db.pantryStaples.toArray();
      const conflicted = staples.filter(
        (s) => s.enabled && stapleViolatesExclusions(s, [next]) !== null,
      );
      if (conflicted.length > 0) {
        await this.db.pantryStaples.bulkPut(conflicted.map((s) => ({ ...s, enabled: false })));
      }
    });
  }

  async addCustomExclusion(draft: CustomExclusionDraft): Promise<Exclusion> {
    const label = draft.label.trim();
    const terms = dedupeTerms([label, ...draft.terms]);
    const exclusion: Exclusion = {
      id: newId('excl'),
      label: label.length > 0 ? label : (terms[0] ?? 'Custom'),
      terms,
      enabled: true,
      custom: true,
    };
    await this.db.exclusions.put(exclusion);
    await this.setExclusionEnabled(exclusion.id, true);
    return exclusion;
  }

  async updateExclusionTerms(id: string, terms: readonly string[]): Promise<void> {
    await this.db.transaction('rw', this.db.exclusions, async () => {
      const current = await this.db.exclusions.get(id);
      if (!current) return;
      await this.db.exclusions.put({ ...current, terms: dedupeTerms(terms) });
    });
  }

  /** Seeded exclusions are disabled, never deleted — only custom ones are removable. */
  async removeCustomExclusion(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.exclusions, async () => {
      const current = await this.db.exclusions.get(id);
      if (!current || !current.custom) return;
      await this.db.exclusions.delete(id);
    });
  }

  // --- settings -----------------------------------------------------------

  async getSettings(): Promise<UserSettings> {
    const existing = await this.db.settings.get(SINGLETON_ID);
    if (existing) return existing;
    const seeded = { ...DEFAULT_SETTINGS };
    await this.db.settings.put(seeded);
    return seeded;
  }

  /**
   * Singleton semantics: always the fixed key, always a put. Writing twice
   * updates one row; it can never accumulate a second settings record.
   */
  async updateSettings(patch: SettingsPatch): Promise<UserSettings> {
    return this.db.transaction('rw', this.db.settings, async () => {
      const current = (await this.db.settings.get(SINGLETON_ID)) ?? { ...DEFAULT_SETTINGS };
      const next: UserSettings = {
        id: SINGLETON_ID,
        servings: clampInt(
          patch.servings ?? current.servings,
          SETTINGS_BOUNDS.servings.min,
          SETTINGS_BOUNDS.servings.max,
          DEFAULT_SETTINGS.servings,
        ),
        spiceTolerance: patch.spiceTolerance ?? current.spiceTolerance,
        weeknightActiveMinuteCeiling: clampInt(
          patch.weeknightActiveMinuteCeiling ?? current.weeknightActiveMinuteCeiling,
          SETTINGS_BOUNDS.weeknightActiveMinuteCeiling.min,
          SETTINGS_BOUNDS.weeknightActiveMinuteCeiling.max,
          DEFAULT_SETTINGS.weeknightActiveMinuteCeiling,
        ),
        onboardingComplete: patch.onboardingComplete ?? current.onboardingComplete,
      };
      await this.db.settings.put(next);
      return next;
    });
  }
}

// `exactOptionalPropertyTypes` is on: an optional property must be absent, not
// `undefined`. These builders keep that explicit rather than scattering
// conditional spreads through the write paths.
function quantityOf(
  draft: Partial<InventoryDraft>,
  prior: InventoryItem | undefined,
): { quantity?: string } {
  const value = draft.quantity ?? prior?.quantity;
  const trimmed = value?.trim();
  return trimmed ? { quantity: trimmed } : {};
}

function categoryOf(
  draft: Partial<InventoryDraft>,
  prior: InventoryItem | undefined,
): { category?: IngredientCategory } {
  const value = draft.category ?? prior?.category;
  return value ? { category: value } : {};
}

function dedupeTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const key = normalize(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** The app-wide instance. Swapped for Agent D's repository at merge. */
export const inventoryRepository: InventoryRepository = new DexieInventoryRepository();
