/**
 * JSON export / import.
 *
 * Local-first with no accounts means the browser owns the only copy. A "clear
 * site data", a private window closing, an OS reinstall — any of them can take
 * six weeks of technique progression with them. Export is the escape hatch that
 * makes "no sync" survivable (`docs/decisions.md` §3), which is why it is a
 * requirement rather than a nice-to-have.
 *
 * Three properties this file is responsible for:
 *
 *   VERSIONED   Every file states its format and version. A file from the
 *               future is refused rather than guessed at.
 *   VALIDATED   Nothing is written until the entire payload has been checked,
 *               including cross-table referential integrity and the saved
 *               recipes' own content hashes.
 *   ALL OR NOTHING  The write is one Dexie transaction across every table. A
 *               malformed file leaves the database exactly as it was; there is
 *               no half-import.
 */

import { z } from 'zod/v4';
import { MiseDatabase, SINGLETON_ID, contentHash, db as defaultDb } from '@contract/db';
import { AmbitionSchema, RecipeSchema } from '@contract/recipe.schema';
import type {
  CookLog,
  DifficultyCalibration,
  Exclusion,
  InventoryItem,
  PantryStaple,
  SavedRecipe,
  TechniqueProgress,
  UserSettings,
} from '@contract/types';

export const EXPORT_FORMAT = 'mise.cookbook.export' as const;

/**
 * Bump when the payload shape changes. Readers accept any version they know
 * about and refuse anything newer; that refusal is the whole reason the field
 * exists, so it must never be relaxed to "try our best".
 */
export const EXPORT_VERSION = 1 as const;

export interface MiseExportData {
  savedRecipes: SavedRecipe[];
  cookLogs: CookLog[];
  techniqueProgress: TechniqueProgress[];
  calibration: DifficultyCalibration[];
  settings: UserSettings[];
  inventory: InventoryItem[];
  pantryStaples: PantryStaple[];
  exclusions: Exclusion[];
}

export interface MiseExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  data: MiseExportData;
}

export type ExportTableName = keyof MiseExportData;

/** Order matters only for readability of the file; every table is exported. */
export const EXPORT_TABLES: readonly ExportTableName[] = [
  'savedRecipes',
  'cookLogs',
  'techniqueProgress',
  'calibration',
  'settings',
  'inventory',
  'pantryStaples',
  'exclusions',
];

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

const StarsSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const SavedRecipeSchema = z.object({
  id: z.string().min(1),
  savedAt: z.number(),
  recipe: RecipeSchema,
  contentHash: z.string().min(1),
  generatedFrom: z.object({
    inventorySnapshot: z.array(z.string()),
    ambition: AmbitionSchema,
    exclusionsActive: z.array(z.string()),
  }),
});

const CookLogSchema = z.object({
  id: z.string().min(1),
  savedRecipeId: z.string().min(1),
  cookedAt: z.number(),
  wouldMakeAgain: z.boolean(),
  actualDifficulty: StarsSchema,
  actualActiveMinutes: z.number().nonnegative(),
  notes: z.string().optional(),
  techniquesPerformed: z.array(z.string()),
});

const TechniqueProgressSchema = z.object({
  technique_id: z.string().min(1),
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  timesPerformed: z.number().int().nonnegative(),
  firstPerformedAt: z.number().nullable(),
  lastPerformedAt: z.number().nullable(),
});

const CalibrationSchema = z.object({
  id: z.literal(SINGLETON_ID),
  starBias: z.number(),
  activeMinuteRatio: z.number(),
  sampleSize: z.number().int().nonnegative(),
  updatedAt: z.number(),
});

const UserSettingsSchema = z.object({
  id: z.literal(SINGLETON_ID),
  servings: z.number().int().positive(),
  spiceTolerance: z.enum(['none', 'mild', 'medium', 'hot']),
  weeknightActiveMinuteCeiling: z.number().int().positive(),
  onboardingComplete: z.boolean(),
});

const InventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  normalized: z.string().min(1),
  quantity: z.string().optional(),
  category: z
    .enum(['produce', 'protein', 'dairy', 'grain', 'condiment', 'spice', 'baking', 'other'])
    .optional(),
  addedAt: z.number(),
});

const PantryStapleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  normalized: z.string().min(1),
  enabled: z.boolean(),
});

const ExclusionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  terms: z.array(z.string()),
  enabled: z.boolean(),
  custom: z.boolean(),
});

const ExportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.number(),
  data: z.object({
    savedRecipes: z.array(SavedRecipeSchema),
    cookLogs: z.array(CookLogSchema),
    techniqueProgress: z.array(TechniqueProgressSchema),
    calibration: z.array(CalibrationSchema),
    settings: z.array(UserSettingsSchema),
    inventory: z.array(InventoryItemSchema),
    pantryStaples: z.array(PantryStapleSchema),
    exclusions: z.array(ExclusionSchema),
  }),
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportAll(
  database: MiseDatabase = defaultDb,
  now: number = Date.now(),
): Promise<MiseExport> {
  // Full scans, deliberately: an export reads every row of every table by
  // definition, so there is no index to ride.
  const [
    savedRecipes,
    cookLogs,
    techniqueProgress,
    calibration,
    settings,
    inventory,
    pantryStaples,
    exclusions,
  ] = await Promise.all([
    database.savedRecipes.toArray(),
    database.cookLogs.toArray(),
    database.techniqueProgress.toArray(),
    database.calibration.toArray(),
    database.settings.toArray(),
    database.inventory.toArray(),
    database.pantryStaples.toArray(),
    database.exclusions.toArray(),
  ]);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now,
    data: {
      savedRecipes,
      cookLogs,
      techniqueProgress,
      calibration,
      settings,
      inventory,
      pantryStaples,
      exclusions,
    },
  };
}

/** Two-space indent: a backup a human can read is a backup a human trusts. */
export function serializeExport(payload: MiseExport): string {
  return JSON.stringify(payload, null, 2);
}

export function exportFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mise-cookbook-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Browser-only. Returns the filename written, or null when there is no DOM. */
export function downloadExport(payload: MiseExport, filename = exportFilename()): string | null {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const blob = new Blob([serializeExport(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

// ---------------------------------------------------------------------------
// Import — validate everything, then write once
// ---------------------------------------------------------------------------

export type ImportValidation =
  | { ok: true; payload: MiseExport }
  | { ok: false; errors: string[] };

/**
 * Check a parsed object. Reports every problem it finds rather than the first,
 * because the person staring at a rejected backup file deserves the full list.
 */
export function validateImport(raw: unknown): ImportValidation {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, errors: ['File does not contain a JSON object.'] };
  }

  const record = raw as Record<string, unknown>;
  if (record['format'] !== EXPORT_FORMAT) {
    return {
      ok: false,
      errors: [
        `Not a Mise export: expected format "${EXPORT_FORMAT}", found ${JSON.stringify(record['format']) ?? 'nothing'}.`,
      ],
    };
  }
  if (typeof record['version'] === 'number' && record['version'] > EXPORT_VERSION) {
    return {
      ok: false,
      errors: [
        `This file was written by a newer version of Mise (format version ${record['version']}, this build understands ${EXPORT_VERSION}). Refusing to guess at it.`,
      ],
    };
  }

  const parsed = ExportSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .slice(0, 25)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    if (parsed.error.issues.length > 25) {
      errors.push(`…and ${parsed.error.issues.length - 25} more problems.`);
    }
    return { ok: false, errors };
  }

  // Shape is fine. Now the things Zod cannot see.
  const payload = parsed.data as unknown as MiseExport;
  const errors: string[] = [];

  for (const table of EXPORT_TABLES) {
    const rows = payload.data[table] as ReadonlyArray<{ id?: string; technique_id?: string }>;
    const seen = new Set<string>();
    for (const row of rows) {
      const key = row.id ?? row.technique_id ?? '';
      if (seen.has(key)) errors.push(`${table}: duplicate primary key "${key}".`);
      seen.add(key);
    }
  }

  for (const saved of payload.data.savedRecipes) {
    if (contentHash(saved.recipe) !== saved.contentHash) {
      errors.push(
        `savedRecipes: "${saved.id}" does not match its own content hash — the snapshot has been altered since it was saved.`,
      );
    }
  }

  const recipeIds = new Set(payload.data.savedRecipes.map((r) => r.id));
  for (const log of payload.data.cookLogs) {
    if (!recipeIds.has(log.savedRecipeId)) {
      errors.push(`cookLogs: "${log.id}" refers to missing saved recipe "${log.savedRecipeId}".`);
    }
  }

  if (payload.data.calibration.length > 1) errors.push('calibration: expected at most one row.');
  if (payload.data.settings.length > 1) errors.push('settings: expected at most one row.');

  return errors.length > 0 ? { ok: false, errors } : { ok: true, payload };
}

/** Parse then validate. A JSON syntax error is reported as one, not thrown. */
export function parseImport(text: string): ImportValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`File is not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  return validateImport(raw);
}

export type ImportReport = {
  ok: true;
  counts: Record<ExportTableName, number>;
};

export class ImportRejected extends Error {
  readonly errors: readonly string[];
  constructor(errors: readonly string[]) {
    super(`Import rejected: ${errors[0] ?? 'unknown problem'}`);
    this.name = 'ImportRejected';
    this.errors = errors;
  }
}

/**
 * Replace the entire database with the contents of an export.
 *
 * REPLACE, not merge. Merging two divergent histories would need conflict rules
 * nobody has specified, and would quietly double-count cook logs — which would
 * inflate technique levels, the one number in the app that has to be earned.
 * Restoring a backup means going back to that backup.
 *
 * Throws `ImportRejected` without writing anything if validation fails.
 */
export async function importAll(
  source: string | unknown,
  database: MiseDatabase = defaultDb,
): Promise<ImportReport> {
  const validation = typeof source === 'string' ? parseImport(source) : validateImport(source);
  if (!validation.ok) throw new ImportRejected(validation.errors);

  const { data } = validation.payload;

  await database.transaction('rw', allTables(database), async () => {
    await clearAllTables(database);
    await Promise.all([
      database.savedRecipes.bulkAdd(data.savedRecipes),
      database.cookLogs.bulkAdd(data.cookLogs),
      database.techniqueProgress.bulkAdd(data.techniqueProgress),
      database.calibration.bulkAdd(data.calibration),
      database.settings.bulkAdd(data.settings),
      database.inventory.bulkAdd(data.inventory),
      database.pantryStaples.bulkAdd(data.pantryStaples),
      database.exclusions.bulkAdd(data.exclusions),
    ]);
  });

  const counts = Object.fromEntries(
    EXPORT_TABLES.map((table) => [table, data[table].length]),
  ) as Record<ExportTableName, number>;

  return { ok: true, counts };
}

/**
 * Delete everything. Exposed because "export, then start clean" is a real
 * thing a person does, and because the import tests need it. Callers are
 * expected to have confirmed with the user first — there is no undo.
 */
export async function wipeAll(database: MiseDatabase = defaultDb): Promise<void> {
  await database.transaction('rw', allTables(database), async () => {
    await clearAllTables(database);
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Every table, in one list. Dexie's variadic `transaction()` overloads stop at
 * five tables, and this needs all eight in one atomic scope — that atomicity is
 * what makes a rejected import leave the database untouched.
 */
function allTables(database: MiseDatabase) {
  return [
    database.savedRecipes,
    database.cookLogs,
    database.techniqueProgress,
    database.calibration,
    database.settings,
    database.inventory,
    database.pantryStaples,
    database.exclusions,
  ];
}

/** Must be called inside a transaction covering `allTables()`. */
async function clearAllTables(database: MiseDatabase): Promise<void> {
  await Promise.all(allTables(database).map((table) => table.clear()));
}
