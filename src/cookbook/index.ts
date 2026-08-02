/**
 * Agent D — cookbook and progression. The public surface of `src/cookbook/`.
 *
 * Nothing outside this directory should import from a file inside it; import
 * from here. What is deliberately NOT exported is as much of the contract as
 * what is:
 *
 *   - No `updateSavedRecipe`, because there is no such thing. A saved recipe is
 *     an immutable snapshot; everything learned afterwards goes on a `CookLog`.
 *   - No raw Dexie handle. This module owns every table in `@contract/db`, and
 *     other modules reach them through `CookbookRepository` (these tables) or
 *     the export/import functions (all eight).
 *   - No `fixtures.ts`, no internal helpers.
 *
 * Who needs what:
 *   Agent A (generation)  `saveRecipe` for the output; `listTechniqueProgress`
 *                         for `GenerationRequest.techniqueProgress`;
 *                         `getApplicableCalibration` for `.calibration`.
 *   Agent B (cook mode)   `getSavedRecipe` to read a snapshot; `logCook` when
 *                         the last step is done.
 *   Agent C (inventory)   nothing — its four tables are its own; the two
 *                         repositories reconcile at integration.
 *   The shell             `CookbookScreen`, or the individual views.
 */

// ---------------------------------------------------------------------------
// Storage — the repository, and the free functions behind it
// ---------------------------------------------------------------------------

export {
  // The named surface. Bind to `cookbookRepository` in app code, or
  // `createCookbookRepository(db)` against a database you supply.
  type CookbookRepository,
  createCookbookRepository,
  cookbookRepository,

  // Saved recipes — write once, read forever.
  saveRecipe,
  getSavedRecipe,
  listSavedRecipes,
  countSavedRecipes,
  deleteSavedRecipe,
  verifySavedRecipe,
  findDriftedRecipes,
  type SaveRecipeInput,

  // Cook logs — where post-cook feedback lives instead.
  logCook,
  listCookLogsFor,
  listRecentCookLogs,
  countCooks,
  cookCountsByRecipe,
  type CookLogInput,

  // Technique progression.
  listTechniqueProgress,
  listOwnedTechniques,
  listStartedTechniques,
  getTechniqueGrid,

  // Calibration.
  getCalibration,
  getApplicableCalibration,

  rebuildDerivedState,
} from './storage';

// ---------------------------------------------------------------------------
// Progression — thresholds live in one place and are read from there
// ---------------------------------------------------------------------------

export {
  LEVEL_THRESHOLDS,
  LEVEL_LABELS,
  PROGRESSION_RULE,
  FAMILY_ORDER,
  FAMILY_LABELS,
  levelForTimesPerformed,
  cooksUntilNextLevel,
  buildTechniqueGrid,
  describeStanding,
  techniquesInRecipe,
  type ProgressLevel,
  type LevelThreshold,
  type TechniqueStanding,
  type FamilyGroup,
} from './progression';

// ---------------------------------------------------------------------------
// Calibration — including the sample floor Agent A must not work around
// ---------------------------------------------------------------------------

export {
  MIN_CALIBRATION_SAMPLE,
  NEUTRAL_CALIBRATION,
  computeCalibration,
  isCalibrationApplicable,
  calibrationForGeneration,
  cooksUntilCalibrated,
  describeCalibration,
  type CalibrationSample,
} from './calibration';

// ---------------------------------------------------------------------------
// Export / import — the escape hatch that makes "no sync" survivable
// ---------------------------------------------------------------------------

export {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  EXPORT_TABLES,
  exportAll,
  serializeExport,
  exportFilename,
  downloadExport,
  validateImport,
  parseImport,
  importAll,
  ImportRejected,
  wipeAll,
  type MiseExport,
  type MiseExportData,
  type ExportTableName,
  type ImportValidation,
  type ImportReport,
} from './exportImport';

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export { CookbookScreen, type CookbookPage } from './CookbookScreen';
export { CookbookList } from './CookbookList';
export { SavedRecipeView } from './SavedRecipeView';
export { CookLogForm } from './CookLogForm';
export { TechniqueGrid } from './TechniqueGrid';
export { TechniqueDetail, VideoSlot } from './TechniqueDetail';
export { DataPanel } from './DataPanel';

// Live queries, for a shell that wants to compose its own views.
export {
  useSavedRecipes,
  useSavedRecipe,
  useCookLogsFor,
  useRecentCookLogs,
  useCookCount,
  useCookCountsByRecipe,
  useTechniqueGrid,
  useCalibration,
} from './hooks';
