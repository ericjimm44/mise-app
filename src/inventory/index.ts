/**
 * Public surface of the inventory module.
 *
 * Other modules — generation especially — should read the user's kitchen through
 * `InventoryRepository`, never by importing a component or reaching into Dexie.
 */

export { InventoryScreen } from './InventoryScreen';
export { useInventoryStore, type InventoryStore } from './useInventoryStore';
export {
  DexieInventoryRepository,
  deriveNormalized,
  inventoryRepository,
  stapleViolatesExclusions,
  type CustomExclusionDraft,
  type InventoryDraft,
  type InventoryRepository,
  type SettingsPatch,
} from './storage';
export {
  candidatesToDrafts,
  manualIngredientSource,
  INGREDIENT_SOURCES,
  type IngredientCandidate,
  type IngredientSource,
  type IngredientSourceId,
} from './sources';
export { inferCategory, searchCatalog, type CatalogEntry } from './catalog';
export { suggestRelatedTerms } from './relatedTerms';
export {
  DEFAULT_PANTRY_STAPLES,
  DEFAULT_SETTINGS,
  SETTINGS_BOUNDS,
  SPICE_TOLERANCE_OPTIONS,
} from './defaults';
