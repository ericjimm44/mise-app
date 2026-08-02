/**
 * CONTRACT — Dexie schema definitions. Frozen. No agent may edit this file.
 *
 * SCHEMA ONLY. No queries live here. Agent D owns all reads and writes against
 * these tables; every other agent goes through Agent D's exports rather than
 * touching Dexie directly. A stray `db.savedRecipes.put()` in the cook-mode
 * module is exactly the cross-module leakage the contract exists to prevent.
 *
 * On indexes: the string after the table name lists the primary key first, then
 * the indexed properties. Properties that are only ever read (never queried on)
 * are deliberately not indexed — an index you do not query is dead weight in
 * IndexedDB.
 */

import Dexie, { type Table } from 'dexie';
import type {
  CookLog,
  DifficultyCalibration,
  Exclusion,
  InventoryItem,
  PantryStaple,
  SavedRecipe,
  TechniqueProgress,
  UserSettings,
} from './types';

export class MiseDatabase extends Dexie {
  inventory!: Table<InventoryItem, string>;
  pantryStaples!: Table<PantryStaple, string>;
  exclusions!: Table<Exclusion, string>;
  settings!: Table<UserSettings, string>;
  savedRecipes!: Table<SavedRecipe, string>;
  cookLogs!: Table<CookLog, string>;
  techniqueProgress!: Table<TechniqueProgress, string>;
  calibration!: Table<DifficultyCalibration, string>;

  constructor(name = 'mise') {
    super(name);

    this.version(1).stores({
      // `normalized` is indexed because inventory matching queries on it.
      inventory: 'id, normalized, category, addedAt',
      // NOTE: `enabled` is deliberately NOT indexed on this table or on
      // `exclusions`, even though both are queried by it.
      //
      // IndexedDB does not accept booleans as keys. A boolean-valued property
      // named in a Dexie index is silently absent from that index, and
      // `.where('enabled').equals(true)` throws at runtime:
      //   "Data provided to an operation does not meet requirements."
      //
      // Filter in memory instead — `.filter((e) => e.enabled)` — which is the
      // right call regardless: these tables hold single-digit to low-double-digit
      // row counts, so a full scan is cheaper than an index lookup would be.
      //
      // (Earlier revisions of this file indexed `enabled` here and described the
      // exclusions read as "the hottest read in the app". Both claims were
      // wrong. Found by Agent D during the Phase 4 build.)
      pantryStaples: 'id, normalized',
      exclusions: 'id',
      settings: 'id',
      // `savedAt` indexed for the cookbook's reverse-chronological list.
      savedRecipes: 'id, savedAt',
      // `savedRecipeId` indexed to find all cooks of one recipe;
      // `cookedAt` for the activity timeline.
      cookLogs: 'id, savedRecipeId, cookedAt',
      // `level` indexed so the XP grid can partition owned vs locked cheaply.
      techniqueProgress: 'technique_id, level, lastPerformedAt',
      calibration: 'id',
    });
  }
}

/**
 * The singleton instance. Agent D owns this; import it there.
 * Tests construct their own `new MiseDatabase(uniqueName)` against
 * fake-indexeddb rather than sharing this one.
 */
export const db = new MiseDatabase();

/** Fixed primary key for the single-row settings and calibration tables. */
export const SINGLETON_ID = 'singleton' as const;

/**
 * Deep-freeze, used when writing a SavedRecipe.
 *
 * A saved recipe is an IMMUTABLE SNAPSHOT: it never regenerates, never
 * re-validates against changed inventory, never silently updates. Freezing on
 * write turns that promise from a convention into a runtime guarantee — a
 * later mutation throws in strict mode instead of quietly succeeding.
 *
 * Note this protects the in-memory object. The IndexedDB row is protected by
 * Agent D never issuing an update against `savedRecipes`, and by `contentHash`
 * making any drift detectable after the fact.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.getOwnPropertyNames(value).forEach((key) => {
    deepFreeze((value as Record<string, unknown>)[key]);
  });
  return Object.freeze(value);
}

/**
 * Stable content hash for a saved recipe, so immutability can be PROVEN rather
 * than asserted. Keys are sorted so that two structurally identical recipes
 * hash identically regardless of property order.
 *
 * FNV-1a: not cryptographic, and does not need to be — this detects accidental
 * drift, not a motivated attacker.
 */
export function contentHash(value: unknown): string {
  const canonical = canonicalStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(',')}}`;
}
