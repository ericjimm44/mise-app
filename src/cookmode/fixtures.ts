/**
 * Test fixtures for Cook Mode. Not shipped UI — imported by `*.test.ts` only.
 *
 * The shape mirrors the brief's own example: sear, rest, sauce. The rest step
 * carries `can_start_next_step_during: true`, which is the coordination case
 * the whole feature exists for — "while the thighs rest, start the sauce".
 */

import type { Recipe, RecipeStep } from '@contract/types';

export const SEAR: RecipeStep = {
  id: 'step-sear',
  title: 'Sear the thighs',
  instruction:
    'Pat the thighs dry, lay them skin-down in the hot pan, and do not move them.',
  technique_id: 'maillard_sear',
  timer_seconds: 300,
  timer_type: 'active',
  can_start_next_step_during: false,
  doneness_cue:
    'The skin releases from the pan on its own and the edge you can see is deep mahogany.',
  failure_mode:
    'Crowd the pan and the released moisture drops the temperature — everything greys and steams instead of browning.',
  chef_note: 'The pan releases the skin when the crust is formed. It is telling you it is ready.',
};

export const REST: RecipeStep = {
  id: 'step-rest',
  title: 'Rest the thighs',
  instruction: 'Move the thighs to a warm plate, skin up, and leave them alone.',
  technique_id: null,
  timer_seconds: 600,
  timer_type: 'passive',
  can_start_next_step_during: true,
  doneness_cue: 'The plate is warm to the back of your hand and no juice has pooled.',
  failure_mode: 'Cutting in early lets the juices run onto the board instead of back into the meat.',
  chef_note: 'Resting is not idleness — it is the muscle reabsorbing what heat pushed out.',
};

export const SAUCE: RecipeStep = {
  id: 'step-sauce',
  title: 'Build the pan sauce',
  instruction: 'Deglaze with the wine, reduce, then swirl in cold butter off the heat.',
  technique_id: 'pan_sauce',
  timer_seconds: 240,
  timer_type: 'active',
  can_start_next_step_during: false,
  doneness_cue: 'The sauce coats the back of a spoon and holds a line drawn through it.',
  failure_mode: 'Let it boil once the butter is in and the emulsion breaks into oil and water.',
  chef_note: 'Cold butter, off the heat, one piece at a time. The temperature is the whole trick.',
};

export const PLATE: RecipeStep = {
  id: 'step-plate',
  title: 'Plate it',
  instruction: 'Thighs skin-up, sauce spooned around rather than over.',
  technique_id: null,
  timer_seconds: null,
  timer_type: null,
  can_start_next_step_during: false,
  doneness_cue: 'The skin is still audibly crisp when you set the plate down.',
  failure_mode: 'Sauce poured over the skin softens the crust you spent five minutes making.',
  chef_note: 'Everything you did to the skin is undone by one careless ladle.',
};

/** A passive step that nevertheless cannot be left — the overshoot case. */
export const PROVE: RecipeStep = {
  id: 'step-prove',
  title: 'Prove the dough',
  instruction: 'Cover and leave somewhere warm until doubled.',
  technique_id: null,
  timer_seconds: 3600,
  timer_type: 'passive',
  can_start_next_step_during: true,
  doneness_cue: 'A floured finger leaves a dent that springs back only halfway.',
  failure_mode: 'Left too long it overproofs, and the crumb turns coarse and sour.',
  chef_note: 'Warmth is a dial on time, not a shortcut past it.',
};

export const TEST_RECIPE: Recipe = {
  title: 'Chicken thighs with a white wine pan sauce',
  one_line_pitch: 'Crisp skin, a sauce built from what sticks to the pan.',
  ambition: 'weeknight',
  servings: 2,
  difficulty: { stars: 3, rationale: 'The sauce can break if the pan is too hot when butter goes in.' },
  skills_required: [
    { technique_id: 'maillard_sear', name: 'Maillard sear', level: 2 },
    { technique_id: 'pan_sauce', name: 'Pan sauce', level: 1 },
  ],
  equipment: { essential: ['heavy frying pan'], helpful: ['fish slice'], substitutions: [] },
  time: { active_minutes: 20, passive_minutes: 10, total_minutes: 25, note: 'The rest overlaps the sauce.' },
  ingredients: [
    { item: 'chicken thighs', amount: 4, unit: null, from_inventory: true },
    { item: 'butter', amount: 30, unit: 'g', from_inventory: true },
  ],
  mise_en_place: ['Thighs patted dry', 'Butter cubed and cold'],
  steps: [SEAR, REST, SAUCE, PLATE],
  plating: 'Thighs skin-up, sauce around the base.',
  what_makes_this_restaurant_grade:
    'The pan sauce is a butter emulsion built on fond — the technique, not the ingredients, is what makes it taste bought.',
  leftovers: 'The sauce will split when reheated; warm the meat and make a fresh spoonful.',
};
