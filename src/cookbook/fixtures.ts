/**
 * Test fixtures for the cookbook module.
 *
 * Lives beside the code rather than in a test directory so the type checker
 * treats it exactly as it treats production code — a fixture that has drifted
 * from the contract is a test that proves nothing. Nothing in the app imports
 * it, so it is tree-shaken out of the bundle.
 */

import type { Ambition, Recipe, RecipeStep } from '@contract/types';

export function makeStep(overrides: Partial<RecipeStep> = {}): RecipeStep {
  return {
    id: 'step-1',
    title: 'Sear the thighs',
    instruction: 'Pat the thighs dry, salt them, and lay them skin-down in the hot pan.',
    technique_id: 'maillard_sear',
    timer_seconds: 480,
    timer_type: 'active',
    can_start_next_step_during: false,
    doneness_cue: 'The skin releases from the pan without tearing and is the colour of strong tea.',
    failure_mode: 'Crowding the pan drops the temperature and the skin greys instead of browning.',
    chef_note: 'The skin releases when it is ready. If it sticks, it is not ready.',
    ...overrides,
  };
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    title: 'Chicken thighs with a pan sauce',
    one_line_pitch: 'Crisp skin, and a sauce built from what the pan gives you.',
    ambition: 'weeknight' as Ambition,
    servings: 2,
    difficulty: {
      stars: 3,
      rationale: 'The sear and the sauce overlap, and a sauce mounted too hot will split.',
    },
    skills_required: [
      { technique_id: 'maillard_sear', name: 'Maillard sear', level: 2 },
      { technique_id: 'pan_sauce', name: 'Pan sauce', level: 1 },
    ],
    equipment: {
      essential: ['Heavy skillet'],
      helpful: ['Fish spatula'],
      substitutions: [{ missing: 'Fish spatula', use_instead: 'Any thin metal turner' }],
    },
    time: {
      active_minutes: 30,
      passive_minutes: 10,
      total_minutes: 35,
      note: 'The rest overlaps with building the sauce.',
    },
    ingredients: [
      { item: 'chicken thighs', amount: 4, unit: null, from_inventory: true },
      { item: 'butter', amount: 30, unit: 'g', from_inventory: true, is_pantry_staple: true },
    ],
    mise_en_place: ['Thighs patted dry and salted', 'Butter cubed and cold'],
    steps: [
      makeStep(),
      makeStep({
        id: 'step-2',
        title: 'Build the sauce',
        technique_id: 'pan_sauce',
        timer_seconds: 180,
        can_start_next_step_during: true,
        doneness_cue: 'A finger drawn through the sauce on a spoon leaves a line that holds.',
      }),
    ],
    plating: 'Thighs skin-up, sauce spooned around rather than over, so the skin stays crisp.',
    what_makes_this_restaurant_grade:
      'The fond left by the sear is the entire flavour base of the sauce — nothing is added to compensate for it.',
    leftovers: 'Sauce and meat keep three days; reheat the meat uncovered so the skin recovers.',
    ...overrides,
  };
}

export const SAMPLE_GENERATED_FROM = {
  inventorySnapshot: ['chicken thighs', 'butter', 'shallot', 'thyme'],
  ambition: 'weeknight' as Ambition,
  exclusionsActive: ['seafood'],
};
