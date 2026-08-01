/**
 * CONTRACT — shared types. Frozen. No agent may edit this file.
 *
 * If you believe something here is wrong, STOP and report to the orchestrator.
 * Do not work around it locally; a divergent local type is how four agents end
 * up shipping four incompatible apps.
 */

// ---------------------------------------------------------------------------
// Techniques — the spine of the product
// ---------------------------------------------------------------------------

/**
 * Stable identifier for a technique. Snake_case, never renamed once shipped:
 * saved recipes and earned XP reference these by id forever.
 */
export type TechniqueId = string;

/**
 * Three levels of knowing a thing. The gap between 1 and 3 is the product.
 *   1 learned   — you have done it once, following instructions
 *   2 practiced — you can do it without reading, and recover when it wobbles
 *   3 owned     — you can do it in an unfamiliar kitchen, and teach it
 */
export type TechniqueLevel = 1 | 2 | 3;

export interface TechniqueLevelDefinition {
  level: TechniqueLevel;
  label: 'learned' | 'practiced' | 'owned';
  /** What the cook can actually do at this level. Concrete, observable. */
  description: string;
}

export interface Technique {
  technique_id: TechniqueId;
  name: string;
  /**
   * One paragraph of food science: WHY it works, mechanistically.
   * Not "this adds flavour" — Maillard, capillary action, protein denaturation.
   * This paragraph is the lesson. It is the reason the app exists.
   */
  why_it_works: string;
  levels: readonly [
    TechniqueLevelDefinition,
    TechniqueLevelDefinition,
    TechniqueLevelDefinition,
  ];
  /** How this goes wrong in a real kitchen, and what it looks like when it does. */
  common_failure_modes: readonly string[];
  /**
   * Null for v1 — text and illustration only. The field exists so adding one
   * real clip later is data entry, not a refactor. One good "pan sauce" video
   * will serve 400 recipes; do not fill this with stock footage.
   */
  videoUrl: string | null;
  /** Grouping for the XP grid. */
  family: TechniqueFamily;
}

export type TechniqueFamily =
  | 'heat'
  | 'knife'
  | 'sauce'
  | 'seasoning'
  | 'dough'
  | 'egg'
  | 'vegetable'
  | 'protein'
  | 'finishing';

// ---------------------------------------------------------------------------
// Difficulty — THREE AXES. Never collapse these into one number.
// ---------------------------------------------------------------------------

/**
 * Axis 1 of 3: likelihood a competent home cook fails.
 *   1 One pan, forgiving timing, failure nearly impossible
 *   2 Requires heat control or basic knife work; one thing can go wrong
 *   3 Two or more processes in parallel; timing matters; a sauce can break
 *   4 Emulsion, temperature precision, or a scratch component; no recovery
 *   5 Multi-day, multi-component, or equipment most homes lack
 */
export type DifficultyStars = 1 | 2 | 3 | 4 | 5;

export interface Difficulty {
  stars: DifficultyStars;
  /** Why this many stars — must reference what can actually go wrong. */
  rationale: string;
}

/** Axis 2 of 3: the skill floor. WHAT you need to know, by name. */
export interface SkillRequirement {
  technique_id: TechniqueId;
  name: string;
  /** The level of this technique the recipe demands. */
  level: TechniqueLevel;
}

/**
 * Axis 3 of 3: effort. Active minutes are hands-on; passive is waiting.
 * These are shown separately and never summed into a single "time" number —
 * a 4-hour braise is not harder than a 40-minute stir-fry, it is easier.
 */
export interface TimeBudget {
  active_minutes: number;
  passive_minutes: number;
  /**
   * Wall-clock time from starting to eating. MUST be <= active + passive,
   * because steps overlap — that overlap is the coordination the app teaches.
   */
  total_minutes: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Ingredients, equipment
// ---------------------------------------------------------------------------

export interface Ingredient {
  item: string;
  /** Null when the amount is inherently uncountable ("a splash", "to taste"). */
  amount: number | null;
  /** Null for countable whole items — "4 chicken thighs" has no unit. */
  unit: string | null;
  /**
   * True when this came from the user's declared inventory or pantry staples.
   *
   * VALIDATION RULE 1: if false, `substitute` MUST be present, or the item must
   * be a declared pantry staple. Otherwise the recipe is DISCARDED and
   * regenerated — never rendered with a shrug. Sending someone to the shop for
   * one shallot is the #1 trust-killer in every competitor.
   */
  from_inventory: boolean;
  /** What to use instead, drawn from what the user actually has. */
  substitute?: string;
  /** Set when the generator matched this to a declared pantry staple. */
  is_pantry_staple?: boolean;
  /** Free-text prep, e.g. "thinly sliced". Kept off `item` so matching stays clean. */
  prep?: string;
}

export interface EquipmentSubstitution {
  missing: string;
  use_instead: string;
}

export interface Equipment {
  /** Without these the dish cannot be made. */
  essential: readonly string[];
  /** Nice to have; the recipe works without them. */
  helpful: readonly string[];
  substitutions: readonly EquipmentSubstitution[];
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type TimerType = 'active' | 'passive';

export interface RecipeStep {
  id: string;
  title: string;
  instruction: string;
  /**
   * VALIDATION RULE 3: must exist in `techniques.ts`, or null when the step is
   * pure mechanics (fetching a bowl) and teaches nothing.
   */
  technique_id: TechniqueId | null;
  /** Null when the step has no meaningful duration. */
  timer_seconds: number | null;
  timer_type: TimerType | null;
  /**
   * Drives Cook Mode's coordination prompt: "While the thighs rest, start the
   * sauce." This field is the single most valuable thing in the schema — home
   * cooks don't fail on instructions, they fail on parallelism.
   */
  can_start_next_step_during: boolean;
  /**
   * What DONE looks, smells or sounds like. Time is a guess; the cue is truth.
   * Every step has one. A step whose doneness can only be described as
   * "when the timer goes off" is a badly written step.
   */
  doneness_cue: string;
  /** How this step goes wrong, and how to recover — or that you can't. */
  failure_mode: string;
  /** The why. This is the lesson hiding inside the instruction. */
  chef_note: string;
}

// ---------------------------------------------------------------------------
// The recipe
// ---------------------------------------------------------------------------

/** How much the cook is signing up for. */
export type Ambition = 'weeknight' | 'elevated' | 'project';

export interface Recipe {
  title: string;
  one_line_pitch: string;
  ambition: Ambition;
  servings: number;
  difficulty: Difficulty;
  skills_required: readonly SkillRequirement[];
  equipment: Equipment;
  time: TimeBudget;
  ingredients: readonly Ingredient[];
  /** Everything prepped before heat goes on. The app is named after this. */
  mise_en_place: readonly string[];
  steps: readonly RecipeStep[];
  plating: string;
  /**
   * Names the technique doing the work. NEVER a claim that the dish is
   * Michelin-starred, restaurant-quality-by-assertion, or "better than takeout".
   * Honesty is the differentiator — every competitor overclaims.
   */
  what_makes_this_restaurant_grade: string;
  leftovers: string;
}

// ---------------------------------------------------------------------------
// User state — inventory, settings, exclusions
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  name: string;
  /** Normalised lowercase singular, for matching. Derived, never user-typed. */
  normalized: string;
  quantity?: string;
  category?: IngredientCategory;
  addedAt: number;
}

export type IngredientCategory =
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'grain'
  | 'condiment'
  | 'spice'
  | 'baking'
  | 'other';

/** Always-available items the generator may use without marking a shopping trip. */
export interface PantryStaple {
  id: string;
  name: string;
  normalized: string;
  enabled: boolean;
}

/**
 * VALIDATION RULE 2: exclusions are an ABSOLUTE FILTER, not a preference.
 * No ingredient, substitution, garnish, or equipment note may violate one.
 * Seafood is excluded by default — see `DEFAULT_EXCLUSIONS`.
 */
export interface Exclusion {
  id: string;
  /** Display label, e.g. "Seafood". */
  label: string;
  /**
   * Every term that counts as a violation — the category name plus specific
   * members plus derived products. "Seafood" must catch anchovy, fish sauce,
   * oyster sauce, XO sauce, bonito, katsuobushi, Worcestershire.
   */
  terms: readonly string[];
  enabled: boolean;
  /** True for user-created exclusions; false for the seeded set. */
  custom: boolean;
}

export type SpiceTolerance = 'none' | 'mild' | 'medium' | 'hot';

export interface UserSettings {
  id: 'singleton';
  servings: number;
  spiceTolerance: SpiceTolerance;
  /** Hard ceiling on active minutes for `weeknight` ambition. */
  weeknightActiveMinuteCeiling: number;
  /** Set once, on first run. */
  onboardingComplete: boolean;
}

// ---------------------------------------------------------------------------
// Cookbook & progression
// ---------------------------------------------------------------------------

/**
 * A saved recipe is an IMMUTABLE SNAPSHOT. It never regenerates, never
 * re-validates against a changed inventory, never silently updates. The recipe
 * you cooked in March is the recipe you read in November.
 *
 * The `recipe` field is deep-frozen on write. Post-cook feedback lives on
 * `CookLog`, separately — never by mutating the snapshot.
 */
export interface SavedRecipe {
  id: string;
  savedAt: number;
  recipe: Recipe;
  /**
   * Integrity hash of `recipe` at save time. Lets the audit prove immutability
   * rather than assert it.
   */
  contentHash: string;
  /** What the user had when this was generated. Context for why it chose what it chose. */
  generatedFrom: {
    inventorySnapshot: readonly string[];
    ambition: Ambition;
    exclusionsActive: readonly string[];
  };
}

export interface CookLog {
  id: string;
  savedRecipeId: string;
  cookedAt: number;
  wouldMakeAgain: boolean;
  /** What it actually felt like, versus what the recipe claimed. */
  actualDifficulty: DifficultyStars;
  actualActiveMinutes: number;
  notes?: string;
  /** Techniques the user reports having actually performed this cook. */
  techniquesPerformed: readonly TechniqueId[];
}

/**
 * Per-user calibration derived from actual-vs-estimated feedback. A cook who
 * consistently finds 3-star recipes easy gets harder suggestions; the app
 * adjusts to the person rather than the person adjusting to the app.
 */
export interface DifficultyCalibration {
  id: 'singleton';
  /** Mean signed error (actual - estimated) across logged cooks. */
  starBias: number;
  /** Mean ratio of actual to estimated active minutes. */
  activeMinuteRatio: number;
  sampleSize: number;
  updatedAt: number;
}

export interface TechniqueProgress {
  technique_id: TechniqueId;
  /** Current level. 0 = locked, never performed. */
  level: 0 | TechniqueLevel;
  timesPerformed: number;
  firstPerformedAt: number | null;
  lastPerformedAt: number | null;
}

// ---------------------------------------------------------------------------
// Generation — request, result, failure
// ---------------------------------------------------------------------------

export interface GenerationRequest {
  inventory: readonly string[];
  pantryStaples: readonly string[];
  exclusions: readonly Exclusion[];
  ambition: Ambition;
  servings: number;
  spiceTolerance: SpiceTolerance;
  weeknightActiveMinuteCeiling: number;
  /** Technique levels the user already owns, so the model can pitch at them. */
  techniqueProgress: readonly TechniqueProgress[];
  calibration?: DifficultyCalibration;
}

/** Why a candidate recipe was thrown away. Surfaced in dev, counted in tests. */
export type RejectionReason =
  | 'malformed_json'
  | 'schema_invalid'
  | 'unavailable_ingredient_without_substitute'
  | 'exclusion_violation'
  | 'unknown_technique_id'
  | 'time_inconsistent'
  | 'overclaim_language';

export interface Rejection {
  reason: RejectionReason;
  detail: string;
  /** Which attempt this was, 1-indexed. */
  attempt: number;
}

export type GenerationResult =
  | { ok: true; recipe: Recipe; attempts: number; rejections: readonly Rejection[] }
  | { ok: false; rejections: readonly Rejection[]; attempts: number };

// ---------------------------------------------------------------------------
// Cook mode
// ---------------------------------------------------------------------------

export type TimerState = 'idle' | 'running' | 'paused' | 'fired' | 'dismissed';

export interface ActiveTimer {
  id: string;
  stepId: string;
  /** Shown in the tray — must identify the step without opening it. */
  label: string;
  type: TimerType;
  durationSeconds: number;
  /** Epoch ms. Timers are computed from wall-clock, never from tick counting,
   *  so backgrounding the tab cannot make a timer drift or stall. */
  startedAt: number;
  /** Accumulated pause time in ms, subtracted when computing remaining. */
  pausedAccumMs: number;
  pausedAt: number | null;
  state: TimerState;
}
