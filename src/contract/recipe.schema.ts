/**
 * CONTRACT — the generation contract. Frozen. No agent may edit this file.
 *
 * Nothing renders until it passes through here. The model returns strict JSON;
 * this module decides whether that JSON is allowed to become a recipe.
 *
 * There are two layers, and they are deliberately separate:
 *
 *   1. `RecipeSchema` — SHAPE. Zod. Is this even a recipe?
 *   2. `validateRecipe()` — TRUTH. Is this recipe safe and honest for THIS user?
 *
 * Layer 2 cannot be expressed in Zod because it needs the user's inventory and
 * exclusion list. Both layers must pass. A recipe that fails either is
 * DISCARDED and REGENERATED — never rendered with a warning, never shown with
 * a "you may need to buy" note. That shrug is the product's death.
 */

import { z } from 'zod';
import { TECHNIQUE_IDS } from './techniques';
import type {
  Exclusion,
  Recipe,
  RejectionReason,
} from './types';

// ---------------------------------------------------------------------------
// Layer 1 — shape
// ---------------------------------------------------------------------------

export const AmbitionSchema = z.enum(['weeknight', 'elevated', 'project']);
export const TimerTypeSchema = z.enum(['active', 'passive']);
export const TechniqueLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const DifficultySchema = z.object({
  stars: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  rationale: z.string().min(1),
});

export const SkillRequirementSchema = z.object({
  technique_id: z.string().min(1),
  name: z.string().min(1),
  level: TechniqueLevelSchema,
});

export const EquipmentSchema = z.object({
  essential: z.array(z.string().min(1)),
  helpful: z.array(z.string().min(1)),
  substitutions: z.array(
    z.object({
      missing: z.string().min(1),
      use_instead: z.string().min(1),
    }),
  ),
});

export const TimeBudgetSchema = z.object({
  active_minutes: z.number().int().nonnegative(),
  passive_minutes: z.number().int().nonnegative(),
  total_minutes: z.number().int().positive(),
  note: z.string(),
});

export const IngredientSchema = z.object({
  item: z.string().min(1),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  from_inventory: z.boolean(),
  substitute: z.string().min(1).optional(),
  is_pantry_staple: z.boolean().optional(),
  prep: z.string().optional(),
});

export const RecipeStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string().min(1),
  technique_id: z.string().nullable(),
  timer_seconds: z.number().int().positive().nullable(),
  timer_type: TimerTypeSchema.nullable(),
  can_start_next_step_during: z.boolean(),
  // Not `.optional()`. Every step earns its doneness cue and its failure mode —
  // they are the difference between a recipe and a lesson.
  doneness_cue: z.string().min(1),
  failure_mode: z.string().min(1),
  chef_note: z.string().min(1),
});

export const RecipeSchema = z.object({
  title: z.string().min(1),
  one_line_pitch: z.string().min(1),
  ambition: AmbitionSchema,
  servings: z.number().int().positive(),
  difficulty: DifficultySchema,
  skills_required: z.array(SkillRequirementSchema).min(1),
  equipment: EquipmentSchema,
  time: TimeBudgetSchema,
  ingredients: z.array(IngredientSchema).min(1),
  mise_en_place: z.array(z.string().min(1)),
  steps: z.array(RecipeStepSchema).min(1),
  plating: z.string().min(1),
  what_makes_this_restaurant_grade: z.string().min(1),
  leftovers: z.string().min(1),
});

export type RecipeSchemaOutput = z.infer<typeof RecipeSchema>;

// ---------------------------------------------------------------------------
// Default exclusions — seafood pre-checked, as specified
// ---------------------------------------------------------------------------

/**
 * Seafood is excluded BY DEFAULT.
 *
 * The term list is deliberately exhaustive and includes the derived products
 * that trip up every other app: fish sauce, oyster sauce, Worcestershire
 * (anchovy), XO sauce, bonito/katsuobushi and the dashi made from it, and
 * Caesar dressing. A generator that avoids "salmon" but reaches for fish sauce
 * to "add depth" has violated the exclusion just as completely.
 */
export const SEAFOOD_TERMS: readonly string[] = [
  // categories
  'seafood', 'fish', 'shellfish', 'crustacean', 'mollusc', 'mollusk',
  // finfish
  'anchovy', 'anchovies', 'bass', 'bream', 'cod', 'haddock', 'hake', 'halibut',
  'herring', 'mackerel', 'mahi', 'monkfish', 'pollock', 'salmon', 'sardine',
  'sea bream', 'snapper', 'sole', 'swordfish', 'tilapia', 'trout', 'tuna',
  'turbot', 'whitebait', 'whiting', 'eel', 'catfish', 'carp', 'plaice',
  'lox', 'gravlax', 'kipper', 'bonito', 'katsuobushi', 'niboshi',
  // shellfish & molluscs
  'clam', 'cockle', 'crab', 'crawfish', 'crayfish', 'cuttlefish', 'langoustine',
  'lobster', 'mussel', 'octopus', 'oyster', 'prawn', 'scallop', 'shrimp',
  'squid', 'calamari', 'whelk', 'abalone', 'periwinkle', 'krill',
  // roe & derived
  'caviar', 'roe', 'ikura', 'tobiko', 'masago', 'bottarga',
  // sauces, pastes and stocks made from the above
  'fish sauce', 'nam pla', 'nuoc mam', 'oyster sauce', 'xo sauce',
  'shrimp paste', 'belacan', 'terasi', 'bagoong', 'colatura',
  'worcestershire', 'caesar dressing', 'dashi', 'fish stock', 'fumet',
  'clam juice', 'surimi', 'fish roe', 'anchovy paste', 'garum',
  // seaweed is not an animal, but is grouped here by user expectation;
  // it stays OUT of the default term list deliberately — nori in a spice
  // blend is not what someone means by "no seafood". Add it as a custom
  // exclusion if wanted.
];

export const DEFAULT_EXCLUSIONS: readonly Exclusion[] = [
  {
    id: 'seafood',
    label: 'Seafood',
    terms: SEAFOOD_TERMS,
    enabled: true, // pre-checked, per the contract
    custom: false,
  },
  {
    id: 'pork',
    label: 'Pork',
    terms: [
      'pork', 'bacon', 'pancetta', 'guanciale', 'prosciutto', 'chorizo',
      'lardo', 'lard', 'ham', 'gammon', 'speck', 'salami', 'coppa',
      'jamon', 'jamón', 'serrano', 'sausage casing', 'pork belly',
      'pork shoulder', 'pork loin', 'salt pork', 'nduja', "'nduja",
    ],
    enabled: false,
    custom: false,
  },
  {
    id: 'shellfish_only',
    label: 'Shellfish only',
    terms: [
      'shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'crayfish',
      'langoustine', 'clam', 'mussel', 'oyster', 'scallop', 'cockle',
      'whelk', 'abalone', 'squid', 'octopus', 'calamari', 'cuttlefish',
    ],
    enabled: false,
    custom: false,
  },
  {
    id: 'peanut',
    label: 'Peanuts',
    terms: ['peanut', 'peanuts', 'groundnut', 'satay', 'peanut butter', 'peanut oil'],
    enabled: false,
    custom: false,
  },
  {
    id: 'tree_nut',
    label: 'Tree nuts',
    terms: [
      'almond', 'hazelnut', 'walnut', 'pecan', 'cashew', 'pistachio',
      'macadamia', 'brazil nut', 'pine nut', 'praline', 'marzipan',
      'frangipane', 'nutella', 'amaretto',
    ],
    enabled: false,
    custom: false,
  },
  {
    id: 'dairy',
    label: 'Dairy',
    terms: [
      'milk', 'butter', 'cream', 'cheese', 'yoghurt', 'yogurt', 'ghee',
      'creme fraiche', 'crème fraîche', 'mascarpone', 'ricotta', 'parmesan',
      'parmigiano', 'pecorino', 'buttermilk', 'custard', 'whey', 'curd',
    ],
    enabled: false,
    custom: false,
  },
  {
    id: 'gluten',
    label: 'Gluten',
    terms: [
      'wheat', 'flour', 'bread', 'breadcrumb', 'panko', 'pasta', 'noodle',
      'couscous', 'semolina', 'barley', 'rye', 'farro', 'spelt', 'bulgur',
      'seitan', 'soy sauce', 'beer', 'puff pastry', 'filo', 'phyllo',
    ],
    enabled: false,
    custom: false,
  },
  {
    id: 'egg',
    label: 'Eggs',
    terms: ['egg', 'eggs', 'mayonnaise', 'aioli', 'meringue', 'custard', 'hollandaise'],
    enabled: false,
    custom: false,
  },
];

// ---------------------------------------------------------------------------
// Overclaim language — the honesty rule, mechanised
// ---------------------------------------------------------------------------

/**
 * We never claim a dish is Michelin-starred. We name the technique that makes
 * it restaurant-grade, then teach it.
 *
 * This is not a style preference — it is the differentiator. So it is enforced
 * by a validator rather than trusted to a prompt, because prompts drift and
 * validators don't.
 */
export const BANNED_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bmichelin\b/i,
  /\bmichelin[-\s]?starred\b/i,
  /\b\d\s*star\s+(restaurant|dining|quality)\b/i,
  /\bjames beard\b/i,
  /\bworld[-\s]?class\b/i,
  /\bbetter than (any )?(restaurant|takeaway|takeout)\b/i,
  /\bgourmet\b/i,
  /\bchef[-\s]?quality\b/i,
];

// ---------------------------------------------------------------------------
// Layer 2 — truth
// ---------------------------------------------------------------------------

export interface ValidationContext {
  /** Everything the user says they have, raw. */
  inventory: readonly string[];
  /** Always-available items. */
  pantryStaples: readonly string[];
  /** Only `enabled` exclusions are enforced; disabled ones are ignored. */
  exclusions: readonly Exclusion[];
}

export interface ValidationFailure {
  reason: RejectionReason;
  detail: string;
}

export type ValidationOutcome =
  | { valid: true }
  | { valid: false; failures: readonly ValidationFailure[] };

/**
 * Normalise for matching: lowercase, strip accents, strip punctuation,
 * collapse whitespace. Used on both sides of every comparison so
 * "Crème Fraîche" and "creme fraiche" are the same string.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word-boundary match, tolerant of a trailing plural.
 *
 * The error direction here is deliberate. A FALSE POSITIVE costs one wasted
 * generation attempt. A FALSE NEGATIVE puts anchovy in the dinner of someone
 * who told us not to. When in doubt, this function blocks.
 *
 * Word boundaries (rather than raw substring) exist only to stop genuinely
 * absurd collisions — "clam" inside "clamp", "cod" inside "cod liver" is fine
 * but "cod" inside "scodella" is not a fish.
 */
export function containsTerm(haystack: string, term: string): boolean {
  const h = normalize(haystack);
  const t = normalize(term);
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(es|s)?($|\\s)`).test(h);
}

/** Every string in a recipe that could smuggle in an excluded ingredient. */
export function collectSearchableStrings(recipe: Recipe): string[] {
  const out: string[] = [
    recipe.title,
    recipe.one_line_pitch,
    recipe.plating, // garnishes hide here
    recipe.what_makes_this_restaurant_grade,
    recipe.leftovers,
    ...recipe.mise_en_place,
    ...recipe.equipment.essential,
    ...recipe.equipment.helpful,
  ];
  for (const ing of recipe.ingredients) {
    out.push(ing.item);
    if (ing.substitute) out.push(ing.substitute); // substitutions hide here
    if (ing.prep) out.push(ing.prep);
  }
  for (const sub of recipe.equipment.substitutions) {
    out.push(sub.missing, sub.use_instead);
  }
  for (const step of recipe.steps) {
    out.push(step.title, step.instruction, step.doneness_cue, step.failure_mode, step.chef_note);
  }
  return out;
}

/** True when `item` is covered by the user's inventory or pantry staples. */
export function isAvailable(item: string, ctx: ValidationContext): boolean {
  const candidates = [...ctx.inventory, ...ctx.pantryStaples];
  const n = normalize(item);
  return candidates.some((c) => {
    const cn = normalize(c);
    if (!cn) return false;
    // Either direction: inventory "chicken thighs" covers "chicken thigh",
    // and inventory "thyme" covers "fresh thyme".
    return n === cn || n.includes(cn) || cn.includes(n);
  });
}

/**
 * THE FOUR RULES. Run in order; all failures are collected so the retry prompt
 * can tell the model everything that was wrong at once rather than one thing
 * per round trip.
 */
export function validateRecipe(recipe: Recipe, ctx: ValidationContext): ValidationOutcome {
  const failures: ValidationFailure[] = [];
  const activeExclusions = ctx.exclusions.filter((e) => e.enabled);

  // --- RULE 2 first: exclusions are absolute, and a violation is the most
  // serious thing that can be wrong. Checked across EVERY string in the recipe,
  // not just the ingredient list.
  const searchable = collectSearchableStrings(recipe);
  for (const exclusion of activeExclusions) {
    for (const term of exclusion.terms) {
      const hit = searchable.find((s) => containsTerm(s, term));
      if (hit !== undefined) {
        failures.push({
          reason: 'exclusion_violation',
          detail: `Exclusion "${exclusion.label}" violated by term "${term}" in: "${hit}"`,
        });
      }
    }
  }

  // --- RULE 1: nothing the user doesn't have, without a substitute.
  for (const ing of recipe.ingredients) {
    if (ing.from_inventory) {
      // The model claimed this is in inventory. Verify — a model asserting
      // `from_inventory: true` about a shallot the user does not own is the
      // same failure wearing a different hat.
      if (!isAvailable(ing.item, ctx)) {
        failures.push({
          reason: 'unavailable_ingredient_without_substitute',
          detail: `"${ing.item}" is marked from_inventory: true but is not in inventory or pantry staples`,
        });
      }
      continue;
    }
    const staple = ing.is_pantry_staple === true && isAvailable(ing.item, ctx);
    if (!staple && (ing.substitute === undefined || ing.substitute.trim() === '')) {
      failures.push({
        reason: 'unavailable_ingredient_without_substitute',
        detail: `"${ing.item}" is not in inventory and has no substitute — this is a shopping trip`,
      });
    }
    // A substitute the user also doesn't have is not a substitute.
    if (ing.substitute !== undefined && ing.substitute.trim() !== '' && !isAvailable(ing.substitute, ctx)) {
      failures.push({
        reason: 'unavailable_ingredient_without_substitute',
        detail: `Substitute "${ing.substitute}" for "${ing.item}" is also not available`,
      });
    }
  }

  // --- RULE 3: every technique_id must exist.
  const known = new Set<string>(TECHNIQUE_IDS);
  for (const skill of recipe.skills_required) {
    if (!known.has(skill.technique_id)) {
      failures.push({
        reason: 'unknown_technique_id',
        detail: `skills_required references unknown technique_id "${skill.technique_id}"`,
      });
    }
  }
  for (const step of recipe.steps) {
    if (step.technique_id !== null && !known.has(step.technique_id)) {
      failures.push({
        reason: 'unknown_technique_id',
        detail: `Step "${step.id}" references unknown technique_id "${step.technique_id}"`,
      });
    }
  }

  // --- RULE 4: time must be internally consistent.
  const { active_minutes, passive_minutes, total_minutes } = recipe.time;
  if (total_minutes > active_minutes + passive_minutes) {
    failures.push({
      reason: 'time_inconsistent',
      detail: `total_minutes (${total_minutes}) exceeds active + passive (${active_minutes + passive_minutes})`,
    });
  }
  if (total_minutes < active_minutes) {
    failures.push({
      reason: 'time_inconsistent',
      detail: `total_minutes (${total_minutes}) is less than active_minutes (${active_minutes}) — you cannot finish before the hands-on work is done`,
    });
  }
  const activeTimerSeconds = recipe.steps
    .filter((s) => s.timer_type === 'active' && s.timer_seconds !== null)
    .reduce((sum, s) => sum + (s.timer_seconds ?? 0), 0);
  // 5-minute grace: not every active minute is inside a timer.
  if (activeTimerSeconds > (active_minutes + 5) * 60) {
    failures.push({
      reason: 'time_inconsistent',
      detail: `Active step timers total ${Math.round(activeTimerSeconds / 60)} min but active_minutes claims ${active_minutes}`,
    });
  }
  const longestStep = recipe.steps.reduce(
    (max, s) => Math.max(max, s.timer_seconds ?? 0),
    0,
  );
  if (longestStep > total_minutes * 60) {
    failures.push({
      reason: 'time_inconsistent',
      detail: `A single step runs ${Math.round(longestStep / 60)} min, longer than total_minutes (${total_minutes})`,
    });
  }

  // --- Honesty rule: no overclaiming, anywhere.
  for (const s of searchable) {
    for (const pattern of BANNED_CLAIM_PATTERNS) {
      if (pattern.test(s)) {
        failures.push({
          reason: 'overclaim_language',
          detail: `Overclaim matched ${pattern} in: "${s}"`,
        });
      }
    }
  }

  return failures.length === 0 ? { valid: true } : { valid: false, failures };
}

/**
 * Parse + validate in one call. This is the ONLY sanctioned path from model
 * output to a rendered recipe. If you find yourself casting a parsed JSON blob
 * to `Recipe`, you have bypassed the contract.
 */
export function parseAndValidate(
  raw: unknown,
  ctx: ValidationContext,
): { ok: true; recipe: Recipe } | { ok: false; failures: readonly ValidationFailure[] } {
  const parsed = RecipeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      failures: parsed.error.issues.map((i) => ({
        reason: 'schema_invalid' as const,
        detail: `${i.path.join('.') || '(root)'}: ${i.message}`,
      })),
    };
  }
  const recipe = parsed.data as Recipe;
  const outcome = validateRecipe(recipe, ctx);
  return outcome.valid ? { ok: true, recipe } : { ok: false, failures: outcome.failures };
}
