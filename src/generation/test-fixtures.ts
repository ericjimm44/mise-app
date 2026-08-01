/**
 * Fixtures for the generation tests. Test-support only — nothing in the app
 * imports this.
 *
 * The "valid" candidate is deliberately built to pass ALL FOUR contract rules
 * against `baseRequest()`: every ingredient is available or substituted, no
 * exclusion term appears anywhere (including plating, leftovers and chef
 * notes), every technique_id exists, and the time budget is internally
 * consistent. The mutators below each break exactly one of those.
 */

import { DEFAULT_EXCLUSIONS } from '@contract/recipe.schema';
import type { GenerationRequest } from '@contract/types';

export type Candidate = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const INVENTORY: readonly string[] = [
  'chicken thighs',
  'yellow onion',
  'garlic',
  'thyme',
  'butter',
  'white wine',
  'chicken stock',
  'carrots',
];

export const PANTRY_STAPLES: readonly string[] = [
  'olive oil',
  'salt',
  'black pepper',
  'flour',
];

export function baseRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    inventory: INVENTORY,
    pantryStaples: PANTRY_STAPLES,
    // Seafood is enabled by default in the seeded set — that is the point.
    exclusions: DEFAULT_EXCLUSIONS,
    ambition: 'weeknight',
    servings: 2,
    spiceTolerance: 'medium',
    weeknightActiveMinuteCeiling: 35,
    techniqueProgress: [
      {
        technique_id: 'maillard_sear',
        level: 3,
        timesPerformed: 7,
        firstPerformedAt: 1,
        lastPerformedAt: 2,
      },
      {
        technique_id: 'sweat_aromatics',
        level: 2,
        timesPerformed: 3,
        firstPerformedAt: 1,
        lastPerformedAt: 2,
      },
      {
        technique_id: 'pan_sauce',
        level: 1,
        timesPerformed: 1,
        firstPerformedAt: 1,
        lastPerformedAt: 1,
      },
    ],
    ...overrides,
  };
}

const VALID_CANDIDATE: Candidate = {
  title: 'Seared chicken thighs with a thyme and white wine pan sauce',
  one_line_pitch:
    'Crisp-skinned thighs, then everything welded to the pan turned into the sauce.',
  ambition: 'weeknight',
  servings: 2,
  difficulty: {
    stars: 3,
    rationale:
      'Two processes run in parallel and the sauce can split if the butter goes in over direct heat.',
  },
  skills_required: [
    { technique_id: 'maillard_sear', name: 'Maillard sear', level: 2 },
    { technique_id: 'pan_sauce', name: 'Pan sauce / fond deglaze', level: 2 },
    { technique_id: 'rest_meat', name: 'Resting meat', level: 1 },
  ],
  equipment: {
    essential: ['heavy skillet', 'tongs', 'wooden spoon'],
    helpful: ['instant-read thermometer'],
    substitutions: [
      { missing: 'instant-read thermometer', use_instead: 'press the thigh and read the give' },
    ],
  },
  time: {
    active_minutes: 25,
    passive_minutes: 20,
    total_minutes: 40,
    note: 'The rest and the sauce overlap, which is where the five minutes come back.',
  },
  ingredients: [
    { item: 'chicken thighs', amount: 4, unit: null, from_inventory: true, prep: 'patted dry' },
    { item: 'yellow onion', amount: 1, unit: null, from_inventory: true, prep: 'finely diced' },
    { item: 'garlic', amount: 3, unit: 'cloves', from_inventory: true, prep: 'sliced thin' },
    { item: 'thyme', amount: null, unit: null, from_inventory: true, prep: 'a few sprigs' },
    { item: 'butter', amount: 30, unit: 'g', from_inventory: true, prep: 'cold, cubed' },
    { item: 'white wine', amount: 120, unit: 'ml', from_inventory: true },
    { item: 'chicken stock', amount: 200, unit: 'ml', from_inventory: true },
    { item: 'salt', amount: null, unit: null, from_inventory: false, is_pantry_staple: true },
    {
      item: 'shallot',
      amount: 1,
      unit: null,
      from_inventory: false,
      substitute: 'yellow onion',
      prep: 'finely diced',
    },
  ],
  mise_en_place: [
    'Chicken patted dry and salted, sitting uncovered',
    'Onion diced, garlic sliced, thyme picked',
    'Wine and stock measured and within reach',
    'Butter cubed and back in the fridge until the last minute',
  ],
  steps: [
    {
      id: 'step-1',
      title: 'Salt the thighs and let them dry',
      instruction:
        'Salt the thighs evenly on both sides and leave them uncovered on a rack while you prep everything else.',
      technique_id: 'dry_brine',
      timer_seconds: null,
      timer_type: null,
      can_start_next_step_during: true,
      doneness_cue: 'The skin looks matte and slightly tacky rather than wet and shiny.',
      failure_mode:
        'Salting and cooking immediately leaves the surface wet with drawn-out moisture, which is the worst possible moment to sear.',
      chef_note:
        'Salt draws moisture out, then that brine is reabsorbed carrying salt inward, seasoning the meat throughout while the surface dries.',
    },
    {
      id: 'step-2',
      title: 'Sear skin-side down',
      instruction:
        'Heat the skillet until a drop of water skitters, add a film of olive oil, and lay the thighs skin-side down. Do not move them.',
      technique_id: 'maillard_sear',
      timer_seconds: 480,
      timer_type: 'active',
      can_start_next_step_during: false,
      doneness_cue:
        'The edge of the skin has gone deep amber and the thigh releases from the pan without tearing.',
      failure_mode:
        'Crowding the pan drops the temperature and everything greys and steams instead of browning.',
      chef_note:
        'Above about 140C the Maillard reaction builds hundreds of aroma compounds that were not in the raw thigh. It cannot start while surface water is still boiling off at 100C.',
    },
    {
      id: 'step-3',
      title: 'Sweat the aromatics in the rendered fat',
      instruction:
        'Lift the thighs out to rest, pour off most of the fat, then cook the onion, shallot and garlic gently with a pinch of salt.',
      technique_id: 'sweat_aromatics',
      timer_seconds: 360,
      timer_type: 'active',
      can_start_next_step_during: true,
      doneness_cue: 'The onion has gone translucent and smells sweet, with no colour on it.',
      failure_mode:
        'Heat too high browns them, which gives an assertive flavour that will dominate the sauce.',
      chef_note:
        'The pinch of salt draws water out osmotically, and that water holds the surface near 100C, below the browning threshold.',
    },
    {
      id: 'step-4',
      title: 'Deglaze and reduce',
      instruction:
        'Pour in the wine, scrape every brown speck loose with the wooden spoon, let it reduce, then add the stock and reduce again.',
      technique_id: 'pan_sauce',
      timer_seconds: 240,
      timer_type: 'active',
      can_start_next_step_during: true,
      doneness_cue:
        'A finger drawn through the sauce on the back of a spoon leaves a line that holds.',
      failure_mode:
        'Reducing past that point gives you something salty and sludgy, and there is no way back.',
      chef_note:
        'The fond is the most flavour-dense material in the pan and it is water-soluble, so liquid and a spoon put it back into the dish instead of down the sink.',
    },
    {
      id: 'step-5',
      title: 'Rest, then finish the sauce off the heat',
      instruction:
        'While the thighs finish resting, take the pan off the heat and whisk in the cold butter a cube at a time. Add the thyme last.',
      technique_id: 'rest_meat',
      timer_seconds: 600,
      timer_type: 'passive',
      can_start_next_step_during: true,
      doneness_cue: 'The sauce turns glossy and coats the spoon rather than running off it.',
      failure_mode:
        'Butter added over direct heat breaks the emulsion into grease and liquid, and it will not come back without a splash of cold liquid and hard whisking.',
      chef_note:
        'Above roughly 60C the milk proteins can no longer hold the butterfat in suspension. Off the heat, they can.',
    },
  ],
  plating:
    'Spoon the sauce onto a warm plate, sit the thighs skin-side up so the crust stays dry, and scatter the thyme over at the last second.',
  what_makes_this_restaurant_grade:
    'The pan sauce. Deglazing the fond is the technique that separates a plate that tastes finished from one that tastes like its components, and it costs nothing but a spoon and two minutes.',
  leftovers:
    'The thighs keep three days. Reheat them skin-side down in a dry pan to bring the crust back, and warm the sauce separately so it does not split.',
};

/** A candidate that passes every contract rule against `baseRequest()`. */
export function validCandidate(): Candidate {
  return clone(VALID_CANDIDATE);
}

/** Violates RULE 2 — a derived seafood product, hidden in the ingredient list. */
export function seafoodCandidate(): Candidate {
  const c = validCandidate();
  const ingredients = c['ingredients'] as Candidate[];
  ingredients.push({
    item: 'fish sauce',
    amount: 1,
    unit: 'tsp',
    from_inventory: false,
    substitute: 'salt',
  });
  return c;
}

/** Violates RULE 1 — an ingredient the cook does not have, with no substitute. */
export function unavailableIngredientCandidate(): Candidate {
  const c = validCandidate();
  const ingredients = c['ingredients'] as Candidate[];
  ingredients.push({
    item: 'tarragon',
    amount: 1,
    unit: 'tbsp',
    from_inventory: false,
  });
  return c;
}

/** Violates RULE 3 — a technique_id that is not in the library. */
export function unknownTechniqueCandidate(): Candidate {
  const c = validCandidate();
  const steps = c['steps'] as Candidate[];
  steps[0]!['technique_id'] = 'flambe_showmanship';
  return c;
}

/** Violates RULE 4 — total is longer than active plus passive. */
export function timeInconsistentCandidate(): Candidate {
  const c = validCandidate();
  c['time'] = {
    active_minutes: 25,
    passive_minutes: 20,
    total_minutes: 90,
    note: 'wrong on purpose',
  };
  return c;
}

/** Violates the honesty rule. */
export function overclaimCandidate(): Candidate {
  const c = validCandidate();
  c['one_line_pitch'] = 'A gourmet dish that is better than takeout.';
  return c;
}

/** Fails Layer 1 — the shape is wrong before truth is even considered. */
export function schemaInvalidCandidate(): Candidate {
  const c = validCandidate();
  delete c['plating'];
  delete c['leftovers'];
  return c;
}
