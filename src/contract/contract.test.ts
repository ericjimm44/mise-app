/**
 * CONTRACT TESTS.
 *
 * These are not "tests for the contract module" — they are the contract's
 * teeth. Every rule stated in prose in the build brief has an assertion here,
 * so drift is a failing build rather than something the Phase 6 audit has to
 * catch by reading.
 *
 * Agents may ADD tests to their own modules. No agent may weaken these.
 */

import { describe, expect, it } from 'vitest';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { TECHNIQUES, TECHNIQUE_IDS, getTechnique } from './techniques';
import {
  BANNED_CLAIM_PATTERNS,
  DEFAULT_EXCLUSIONS,
  RecipeSchema,
  containsTerm,
  normalize,
  parseAndValidate,
  validateRecipe,
  type ValidationContext,
} from './recipe.schema';
import { MiseDatabase, contentHash, deepFreeze } from './db';
import type { Recipe } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CTX: ValidationContext = {
  inventory: ['chicken thighs', 'shallot', 'butter', 'dry white wine', 'thyme'],
  pantryStaples: ['salt', 'black pepper', 'olive oil'],
  exclusions: DEFAULT_EXCLUSIONS,
};

/** A recipe that passes every rule. Deep-cloned per call so tests can mutate. */
function validRecipe(): Recipe {
  return structuredClone({
    title: 'Chicken thighs with a white wine pan sauce',
    one_line_pitch: 'Crisp skin, a sauce built from what sticks to the pan.',
    ambition: 'weeknight',
    servings: 2,
    difficulty: {
      stars: 3,
      rationale: 'The sauce can break if the butter goes in over direct heat.',
    },
    skills_required: [
      { technique_id: 'dry_brine', name: 'Dry brine', level: 1 },
      { technique_id: 'pan_sauce', name: 'Pan sauce / fond deglaze', level: 2 },
    ],
    equipment: {
      essential: ['heavy skillet'],
      helpful: ['instant-read thermometer'],
      substitutions: [
        { missing: 'instant-read thermometer', use_instead: 'press test with a fingertip' },
      ],
    },
    time: {
      active_minutes: 25,
      passive_minutes: 50,
      total_minutes: 55,
      note: 'Total is less than active plus passive because the rest overlaps the sauce.',
    },
    ingredients: [
      { item: 'chicken thighs', amount: 4, unit: null, from_inventory: true },
      { item: 'shallot', amount: 1, unit: null, from_inventory: true },
      { item: 'butter', amount: 30, unit: 'g', from_inventory: true },
      { item: 'dry white wine', amount: 120, unit: 'ml', from_inventory: true },
      { item: 'thyme', amount: null, unit: null, from_inventory: true },
      { item: 'salt', amount: null, unit: null, from_inventory: true },
    ],
    mise_en_place: ['Shallot minced', 'Butter cubed and cold', 'Wine measured'],
    steps: [
      {
        id: 's1',
        title: 'Dry-brine the thighs',
        instruction: 'Salt the skin evenly and leave uncovered in the fridge.',
        technique_id: 'dry_brine',
        timer_seconds: 2400,
        timer_type: 'passive',
        can_start_next_step_during: true,
        doneness_cue: 'Skin looks matte and dry, not tacky',
        failure_mode: 'If the skin is still wet it steams instead of crisping — pat and wait',
        chef_note: 'The salt seasons through and the surface dries. Two payoffs, one step.',
      },
      {
        id: 's2',
        title: 'Render the skin',
        instruction: 'Start skin-side down in a barely warm pan and let the fat render.',
        technique_id: 'render_skin_crisp',
        timer_seconds: 480,
        timer_type: 'active',
        can_start_next_step_during: false,
        doneness_cue: 'Skin releases from the pan without tugging',
        failure_mode: 'A pan too hot at the start seizes the skin and traps fat beneath it',
        chef_note: 'Slow rendering is what makes skin glassy rather than merely browned.',
      },
      {
        id: 's3',
        title: 'Rest the thighs',
        instruction: 'Move to a warm plate and tent loosely.',
        technique_id: 'rest_meat',
        timer_seconds: 600,
        timer_type: 'passive',
        can_start_next_step_during: true,
        doneness_cue: 'Juices no longer run when the plate is tilted',
        failure_mode: 'Wrapping tightly traps steam and softens the skin you just crisped',
        chef_note: 'Use this window for the sauce — that is the whole point of the overlap.',
      },
      {
        id: 's4',
        title: 'Build the pan sauce',
        instruction: 'Pour off fat, add wine, scrape the fond, reduce, then finish off heat.',
        technique_id: 'pan_sauce',
        timer_seconds: 300,
        timer_type: 'active',
        can_start_next_step_during: false,
        doneness_cue: 'A finger drawn through the sauce on a spoon leaves a line that holds',
        failure_mode: 'Butter added over direct heat splits the sauce into oil and solids',
        chef_note: 'The fond is the most flavour-dense material in the pan.',
      },
    ],
    plating: 'Thighs skin-up, sauce spooned around rather than over, thyme scattered.',
    what_makes_this_restaurant_grade:
      'The pan sauce. Deglazing fond is the single technique that separates a finished plate from a set of components.',
    leftovers: 'Shred the meat into the sauce; it keeps two days and reheats gently.',
  } satisfies Recipe);
}

// ---------------------------------------------------------------------------
// Technique library
// ---------------------------------------------------------------------------

describe('technique library', () => {
  it('seeds exactly 40 techniques', () => {
    expect(TECHNIQUES).toHaveLength(40);
  });

  it('has unique, stable, snake_case ids', () => {
    const ids = TECHNIQUES.map((t) => t.technique_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('leaves every videoUrl null — v1 is text and illustration only', () => {
    for (const t of TECHNIQUES) expect(t.videoUrl).toBeNull();
  });

  it('gives every technique three levels, in order, correctly labelled', () => {
    for (const t of TECHNIQUES) {
      expect(t.levels).toHaveLength(3);
      expect(t.levels.map((l) => l.level)).toEqual([1, 2, 3]);
      expect(t.levels.map((l) => l.label)).toEqual(['learned', 'practiced', 'owned']);
      for (const l of t.levels) expect(l.description.length).toBeGreaterThan(20);
    }
  });

  it('explains why each technique works, at length — this is the lesson', () => {
    for (const t of TECHNIQUES) {
      expect(t.why_it_works.length).toBeGreaterThan(200);
    }
  });

  it('names at least three failure modes per technique', () => {
    for (const t of TECHNIQUES) {
      expect(t.common_failure_modes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('resolves ids through the lookup', () => {
    expect(getTechnique('pan_sauce')?.name).toBe('Pan sauce / fond deglaze');
    expect(getTechnique('not_a_technique')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The baseline
// ---------------------------------------------------------------------------

describe('a well-formed recipe', () => {
  it('passes both layers', () => {
    const result = parseAndValidate(validRecipe(), CTX);
    expect(result.ok).toBe(true);
  });

  it('only references techniques that exist', () => {
    const recipe = validRecipe();
    const referenced = [
      ...recipe.skills_required.map((s) => s.technique_id),
      ...recipe.steps.map((s) => s.technique_id).filter((id): id is string => id !== null),
    ];
    for (const id of referenced) expect(TECHNIQUE_IDS).toContain(id);
  });
});

// ---------------------------------------------------------------------------
// RULE 1 — nothing you don't have, without a substitute
// ---------------------------------------------------------------------------

describe('RULE 1 — no silent shopping trips', () => {
  it('rejects an unavailable ingredient with no substitute', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'tarragon',
      amount: null,
      unit: null,
      from_inventory: false,
    });
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.failures.some((f) => f.reason === 'unavailable_ingredient_without_substitute')).toBe(true);
    }
  });

  it('accepts an unavailable ingredient WITH a substitute the user actually has', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'tarragon',
      amount: null,
      unit: null,
      from_inventory: false,
      substitute: 'thyme',
    });
    expect(validateRecipe(r, CTX).valid).toBe(true);
  });

  it('rejects a substitute the user ALSO does not have — that is not a substitute', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'tarragon',
      amount: null,
      unit: null,
      from_inventory: false,
      substitute: 'chervil',
    });
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
  });

  it('catches a model lying about from_inventory', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'saffron',
      amount: null,
      unit: null,
      from_inventory: true, // claimed, but not in the inventory list
    });
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.failures[0]?.reason).toBe('unavailable_ingredient_without_substitute');
    }
  });
});

// ---------------------------------------------------------------------------
// RULE 2 — exclusions are absolute
// ---------------------------------------------------------------------------

describe('RULE 2 — exclusions are an absolute filter', () => {
  it('excludes seafood BY DEFAULT', () => {
    const seafood = DEFAULT_EXCLUSIONS.find((e) => e.id === 'seafood');
    expect(seafood?.enabled).toBe(true);
  });

  it('blocks seafood as a main ingredient', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'salmon fillet',
      amount: 2,
      unit: null,
      from_inventory: true,
    });
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.failures.some((f) => f.reason === 'exclusion_violation')).toBe(true);
  });

  it('blocks seafood hiding in a SUBSTITUTION', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'capers',
      amount: null,
      unit: null,
      from_inventory: false,
      substitute: 'chopped anchovy',
    });
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.failures.some((f) => f.reason === 'exclusion_violation')).toBe(true);
  });

  it('blocks seafood hiding in a GARNISH on the plating line', () => {
    const r = validRecipe();
    r.plating = 'Finish with a scattering of bottarga over the top.';
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.failures.some((f) => f.reason === 'exclusion_violation')).toBe(true);
  });

  it('blocks derived products — fish sauce, oyster sauce, Worcestershire, dashi', () => {
    for (const smuggled of [
      'a dash of fish sauce',
      'a spoon of oyster sauce',
      'a few drops of Worcestershire',
      'a ladle of dashi',
      'a pinch of katsuobushi',
    ]) {
      const r = validRecipe();
      r.steps[3]!.instruction = `Reduce the wine, then add ${smuggled} for depth.`;
      const out = validateRecipe(r, CTX);
      expect(out.valid, `should have blocked: ${smuggled}`).toBe(false);
    }
  });

  it('blocks seafood in a chef note or a failure mode', () => {
    const r = validRecipe();
    r.steps[0]!.chef_note = 'The same approach works for a trout fillet.';
    expect(validateRecipe(r, CTX).valid).toBe(false);
  });

  it('ignores exclusions the user has switched off', () => {
    const r = validRecipe();
    (r.ingredients as Recipe['ingredients'][number][]).push({
      item: 'bacon',
      amount: null,
      unit: null,
      from_inventory: false,
      substitute: 'butter',
    });
    // `pork` ships disabled, so this passes.
    expect(validateRecipe(r, CTX).valid).toBe(true);

    // Switch it on and the same recipe is rejected.
    const strict: ValidationContext = {
      ...CTX,
      exclusions: DEFAULT_EXCLUSIONS.map((e) =>
        e.id === 'pork' ? { ...e, enabled: true } : e,
      ),
    };
    expect(validateRecipe(r, strict).valid).toBe(false);
  });

  it('matches on word boundaries, so "clamp" is not a clam', () => {
    expect(containsTerm('spring clamp', 'clam')).toBe(false);
    expect(containsTerm('fresh clams', 'clam')).toBe(true);
    expect(containsTerm('CLAM', 'clam')).toBe(true);
  });

  it('normalises accents and case before matching', () => {
    expect(normalize('Crème Fraîche')).toBe('creme fraiche');
    expect(containsTerm('Crème Fraîche', 'creme fraiche')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RULE 3 — techniques must exist
// ---------------------------------------------------------------------------

describe('RULE 3 — every technique_id must resolve', () => {
  it('rejects an invented technique on a step', () => {
    const r = validRecipe();
    r.steps[1]!.technique_id = 'flambe_theatrics';
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.failures.some((f) => f.reason === 'unknown_technique_id')).toBe(true);
  });

  it('rejects an invented technique in skills_required', () => {
    const r = validRecipe();
    (r.skills_required as { technique_id: string; name: string; level: 1 }[])[0] = {
      technique_id: 'sous_vide_circulator',
      name: 'Sous vide',
      level: 1,
    };
    expect(validateRecipe(r, CTX).valid).toBe(false);
  });

  it('allows a null technique_id for steps that teach nothing', () => {
    const r = validRecipe();
    r.steps[1]!.technique_id = null;
    expect(validateRecipe(r, CTX).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RULE 4 — time must be consistent
// ---------------------------------------------------------------------------

describe('RULE 4 — time consistency', () => {
  it('rejects a total greater than active + passive', () => {
    const r = validRecipe();
    r.time = { ...r.time, active_minutes: 10, passive_minutes: 10, total_minutes: 30 };
    const out = validateRecipe(r, CTX);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.failures.some((f) => f.reason === 'time_inconsistent')).toBe(true);
  });

  it('rejects a total shorter than the hands-on time', () => {
    const r = validRecipe();
    r.time = { ...r.time, active_minutes: 60, passive_minutes: 60, total_minutes: 30 };
    expect(validateRecipe(r, CTX).valid).toBe(false);
  });

  it('rejects active timers that exceed the claimed active minutes', () => {
    const r = validRecipe();
    r.steps[1]!.timer_seconds = 7200; // 2h of "active" work
    r.steps[1]!.timer_type = 'active';
    expect(validateRecipe(r, CTX).valid).toBe(false);
  });

  it('rejects a single step longer than the whole recipe', () => {
    const r = validRecipe();
    r.steps[0]!.timer_seconds = 60 * 60 * 4;
    expect(validateRecipe(r, CTX).valid).toBe(false);
  });

  it('allows total < active + passive, because steps overlap', () => {
    const r = validRecipe();
    expect(r.time.total_minutes).toBeLessThan(r.time.active_minutes + r.time.passive_minutes);
    expect(validateRecipe(r, CTX).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Honesty
// ---------------------------------------------------------------------------

describe('the honesty rule', () => {
  it('rejects the word Michelin anywhere in a recipe', () => {
    for (const field of ['title', 'one_line_pitch', 'plating', 'leftovers'] as const) {
      const r = validRecipe();
      r[field] = 'A Michelin-starred plate at home';
      const out = validateRecipe(r, CTX);
      expect(out.valid, `Michelin slipped through in ${field}`).toBe(false);
      if (!out.valid) expect(out.failures.some((f) => f.reason === 'overclaim_language')).toBe(true);
    }
  });

  it('rejects Michelin in the restaurant-grade field specifically', () => {
    const r = validRecipe();
    r.what_makes_this_restaurant_grade = 'This is genuinely Michelin standard.';
    expect(validateRecipe(r, CTX).valid).toBe(false);
  });

  it('rejects the other overclaims too', () => {
    for (const claim of [
      'a world-class result',
      'better than any restaurant',
      'truly gourmet',
      'chef-quality at home',
    ]) {
      const r = validRecipe();
      r.one_line_pitch = claim;
      expect(validateRecipe(r, CTX).valid, `allowed: ${claim}`).toBe(false);
    }
  });

  it('still allows naming the technique that does the work', () => {
    const r = validRecipe();
    r.what_makes_this_restaurant_grade =
      'The pan sauce. Fond is concentrated Maillard product, and deglazing it is what finishes the plate.';
    expect(validateRecipe(r, CTX).valid).toBe(true);
  });

  it('has at least one pattern covering Michelin', () => {
    expect(BANNED_CLAIM_PATTERNS.some((p) => p.test('michelin'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe('schema shape', () => {
  it('rejects a step missing its doneness cue', () => {
    const r = validRecipe() as unknown as Record<string, unknown>;
    const steps = r['steps'] as Record<string, unknown>[];
    delete steps[0]!['doneness_cue'];
    const out = parseAndValidate(r, CTX);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failures[0]?.reason).toBe('schema_invalid');
  });

  it('rejects a difficulty of 6 stars — the scale is 1 to 5', () => {
    const r = validRecipe() as unknown as Record<string, unknown>;
    r['difficulty'] = { stars: 6, rationale: 'very hard' };
    expect(parseAndValidate(r, CTX).ok).toBe(false);
  });

  it('rejects prose or markdown fences instead of JSON', () => {
    expect(parseAndValidate('```json\n{}\n```', CTX).ok).toBe(false);
    expect(parseAndValidate("Here's a lovely recipe for you!", CTX).ok).toBe(false);
  });

  it('keeps difficulty as three separate axes, never collapsed', () => {
    const r = validRecipe();
    expect(r.difficulty.stars).toBeTypeOf('number'); // axis 1
    expect(r.skills_required.length).toBeGreaterThan(0); // axis 2
    expect(r.time.active_minutes).toBeTypeOf('number'); // axis 3
    expect(r.time.passive_minutes).toBeTypeOf('number');
    // Active and passive are reported separately and never summed away.
    expect(Object.keys(r.time)).toContain('active_minutes');
    expect(Object.keys(r.time)).toContain('passive_minutes');
  });
});

// ---------------------------------------------------------------------------
// Structured outputs
// ---------------------------------------------------------------------------

/**
 * REGRESSION GUARD.
 *
 * `RecipeSchema` must stay compatible with the Anthropic SDK's
 * `zodOutputFormat`, which imports `zod/v4`. Building the schema with the v3
 * classic API (`import { z } from 'zod'`) compiles but throws at runtime with
 * "Cannot read properties of undefined (reading 'def')" — a failure that
 * surfaces only on a live API call, i.e. in the kitchen rather than in CI.
 *
 * Found by Agent A during the Phase 4 build, which reported it rather than
 * working around it. That is the contract process working as designed.
 */
describe('structured outputs compatibility', () => {
  it('converts to a json_schema output format without throwing', () => {
    const format = zodOutputFormat(RecipeSchema);
    expect(format.type).toBe('json_schema');
  });

  it('emits every top-level recipe field into the schema', () => {
    const format = zodOutputFormat(RecipeSchema) as unknown as {
      schema: { properties: Record<string, unknown> };
    };
    const emitted = Object.keys(format.schema.properties);
    for (const key of Object.keys(RecipeSchema.shape)) {
      expect(emitted, `"${key}" missing from the generated JSON Schema`).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// Dexie schema
// ---------------------------------------------------------------------------

/**
 * REGRESSION GUARD.
 *
 * IndexedDB does not accept booleans as keys. Declaring a boolean property in
 * a Dexie index compiles, stores fine, and silently omits every row from that
 * index — then throws only when something queries it. This file shipped that
 * mistake on `exclusions.enabled` and `pantryStaples.enabled`, with a comment
 * recommending the exact query that throws.
 *
 * These tests pin both halves: the query genuinely fails, and the filter path
 * we use instead genuinely works.
 */
describe('Dexie schema: no boolean indexes', () => {
  it('confirms a boolean-keyed query throws, which is why enabled is unindexed', async () => {
    const db = new MiseDatabase(`schema-probe-${Math.random().toString(36).slice(2)}`);
    await db.exclusions.bulkAdd(DEFAULT_EXCLUSIONS.map((e) => ({ ...e })));
    await expect(
      db.exclusions.where('enabled').equals(true as never).toArray(),
    ).rejects.toThrow();
    db.close();
  });

  it('reads active exclusions by in-memory filter instead', async () => {
    const db = new MiseDatabase(`schema-filter-${Math.random().toString(36).slice(2)}`);
    await db.exclusions.bulkAdd(DEFAULT_EXCLUSIONS.map((e) => ({ ...e })));
    const active = await db.exclusions.filter((e) => e.enabled).toArray();
    // Seafood, and only seafood, ships enabled.
    expect(active.map((e) => e.id)).toEqual(['seafood']);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('saved recipes are immutable', () => {
  it('deep-freezes nested structures', () => {
    const frozen = deepFreeze(validRecipe());
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.steps)).toBe(true);
    expect(Object.isFrozen(frozen.steps[0])).toBe(true);
    expect(Object.isFrozen(frozen.time)).toBe(true);
  });

  it('throws in strict mode when something tries to mutate a saved recipe', () => {
    const frozen = deepFreeze(validRecipe());
    expect(() => {
      (frozen as { title: string }).title = 'Rewritten';
    }).toThrow();
  });

  it('hashes stably regardless of key order', () => {
    const a = { title: 'x', time: { active_minutes: 1, passive_minutes: 2 } };
    const b = { time: { passive_minutes: 2, active_minutes: 1 }, title: 'x' };
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('detects drift', () => {
    const before = contentHash(validRecipe());
    const changed = validRecipe();
    changed.title = 'Something else';
    expect(contentHash(changed)).not.toBe(before);
  });
});
