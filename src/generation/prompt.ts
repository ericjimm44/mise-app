/**
 * Prompt construction.
 *
 * The prompt is a deliverable, not glue. It is split in two on purpose:
 *
 *   - `buildSystemPrompt()` is the STABLE prefix — rubric, technique library,
 *     tier definitions, format and honesty rules. Identical on every request,
 *     so it carries the prompt-caching breakpoint. (Cache minimum on Claude
 *     Opus 5 is 512 tokens; the technique library alone clears that easily.)
 *   - `buildUserPrompt()` is the VOLATILE part — inventory, staples,
 *     exclusions, this cook's technique history, and on a retry the exact
 *     reasons the last candidate was thrown away.
 *
 * Everything the validator enforces is also stated here. The validator is the
 * guarantee; the prompt is what stops us paying for a round trip to learn it.
 */

import { BANNED_CLAIM_PATTERNS } from '@contract/recipe.schema';
import { TECHNIQUES, getTechnique } from '@contract/techniques';
import type {
  Ambition,
  Exclusion,
  GenerationRequest,
  TechniqueProgress,
} from '@contract/types';
import type { SystemBlock } from './client';
import type { ValidationFailure } from '@contract/recipe.schema';

// ---------------------------------------------------------------------------
// Ambition tiers — real constraints, not a vibe
// ---------------------------------------------------------------------------

export interface AmbitionRules {
  label: string;
  starsMin: number;
  starsMax: number;
  summary: string;
}

export const AMBITION_RULES: Readonly<Record<Ambition, AmbitionRules>> = {
  weeknight: {
    label: 'Weeknight',
    starsMin: 1,
    starsMax: 3,
    summary:
      'Active minutes MUST NOT exceed the cook\'s weeknight active-minute ceiling. ' +
      'One or two techniques total. At most 3 stars. Passive time is fine only if ' +
      'the cook is not tied to the kitchen for it. No multi-component builds, no ' +
      'scratch stocks, no components that must be started the day before.',
  },
  elevated: {
    label: 'Elevated',
    starsMin: 3,
    starsMax: 4,
    summary:
      'Build the dish around at least one technique the cook does NOT yet own ' +
      '(level 3). 3 or 4 stars. The new technique should be the point of the ' +
      'dish, not a garnish on it — the cook should finish having practised it ' +
      'properly. Introduce at most one genuinely new technique; everything else ' +
      'should be something they already have.',
  },
  project: {
    label: 'Project',
    starsMin: 4,
    starsMax: 5,
    summary:
      'Multi-component or multi-day. 4 or 5 stars. Long passive time is a ' +
      'feature, not a problem — say so in `time.note`. The cook has chosen to ' +
      'spend the day on this; give them something with real structure and ' +
      'sequencing, and use `can_start_next_step_during` to teach the ' +
      'coordination.',
  },
};

// ---------------------------------------------------------------------------
// Star rubric — lifted from the contract's `DifficultyStars` docs so the model
// grades difficulty against the same ruler the app displays.
// ---------------------------------------------------------------------------

const STAR_RUBRIC = `1 star  — One pan, forgiving timing, failure nearly impossible.
2 stars — Requires heat control or basic knife work; one thing can go wrong.
3 stars — Two or more processes in parallel; timing matters; a sauce can break.
4 stars — Emulsion, temperature precision, or a scratch component; no recovery.
5 stars — Multi-day, multi-component, or equipment most homes lack.`;

function techniqueLibraryBlock(): string {
  const byFamily = new Map<string, string[]>();
  for (const t of TECHNIQUES) {
    const list = byFamily.get(t.family) ?? [];
    list.push(`  ${t.technique_id} — ${t.name}`);
    byFamily.set(t.family, list);
  }
  const sections: string[] = [];
  for (const [family, lines] of byFamily) {
    sections.push(`${family.toUpperCase()}\n${lines.join('\n')}`);
  }
  return sections.join('\n\n');
}

function bannedLanguageBlock(): string {
  const patterns = BANNED_CLAIM_PATTERNS.map((p) => `  ${p.toString()}`).join('\n');
  return `A validator rejects the whole recipe if ANY string in it matches one of
these regular expressions. This is not a style preference — honesty is the
product's entire differentiator, and every competitor overclaims.

${patterns}

In practice: never write "Michelin", "Michelin-starred", "N-star restaurant/
dining/quality", "James Beard", "world-class", "gourmet", "chef-quality", or
"better than takeout/takeaway/any restaurant" — anywhere, including the title,
the pitch, the plating note and the chef notes.

Instead, in \`what_makes_this_restaurant_grade\`, NAME THE TECHNIQUE that is
doing the work and explain the mechanism in one or two sentences. "The fond from
the sear is deglazed into the sauce, so nothing that browned gets thrown away"
is the register we want.`;
}

// ---------------------------------------------------------------------------
// System prompt — the stable, cacheable prefix
// ---------------------------------------------------------------------------

export function buildSystemPromptText(): string {
  return `You are the recipe engine for Mise, an app whose thesis is that a recipe is
disposable and a technique is permanent. Every dish you write is a lesson
disguised as dinner: it is built on NAMED techniques from a fixed library, and
the cook keeps the technique long after they've forgotten the recipe.

You return a single recipe object matching the provided JSON schema. Nothing
else — no prose, no commentary.

================================================================================
HARD RULES — a recipe that breaks any of these is discarded and regenerated,
which costs the user a round trip and costs the operator real money.
================================================================================

1. INGREDIENTS THE COOK DOES NOT HAVE
   Every ingredient must either be in the cook's inventory or declared pantry
   staples, or carry a \`substitute\` that IS in one of those lists.
   - \`from_inventory: true\` is a factual claim. Only set it when the item is
     genuinely on one of the lists you are given.
   - If you reach outside the lists, set \`from_inventory: false\` AND provide a
     \`substitute\` drawn from inside them. A substitute the cook also doesn't
     have is not a substitute.
   - If the item is a declared pantry staple, set \`is_pantry_staple: true\`.
   Sending someone to the shop for one shallot is the single biggest
   trust-killer in this category of app. Do not do it.

2. EXCLUSIONS ARE ABSOLUTE
   Exclusions are a filter, not a preference. No ingredient, substitution,
   garnish, equipment note, plating suggestion or chef note may violate one.
   This includes DERIVED products: "no seafood" also means no fish sauce, no
   oyster sauce, no Worcestershire (anchovy), no XO sauce, no dashi, no bonito
   or katsuobushi, no shrimp paste, no Caesar dressing, no bottarga. The exact
   banned term list is given in the request; every string in your output is
   checked against it.

3. TECHNIQUE IDS MUST EXIST
   Every \`technique_id\` in \`skills_required\` and in every step must be one of
   the identifiers in the library below, copied exactly. Do not invent, rename
   or pluralise one. A step that teaches nothing (fetch a bowl, preheat the
   oven) uses \`technique_id: null\` — that is correct, not lazy.

4. TIME MUST BE INTERNALLY CONSISTENT
   - \`active_minutes\` is hands-on. \`passive_minutes\` is waiting.
   - \`total_minutes\` <= \`active_minutes\` + \`passive_minutes\` (steps overlap —
     that overlap is the coordination the app exists to teach).
   - \`total_minutes\` >= \`active_minutes\`. You cannot finish before the
     hands-on work is done.
   - The sum of \`timer_seconds\` across steps marked \`timer_type: "active"\`
     must not exceed \`active_minutes\` (a five-minute grace is allowed).
   - No single step's \`timer_seconds\` may exceed \`total_minutes\`.

================================================================================
DIFFICULTY — grade against this ruler, do not freelance
================================================================================

${STAR_RUBRIC}

\`difficulty.rationale\` must reference what can actually go wrong at that level.
"It's a bit tricky" is not a rationale. "The butter can break the sauce if the
pan is still over heat" is.

Difficulty has three independent axes and they are never collapsed into one
number: stars (likelihood of failure), \`skills_required\` (the skill floor, by
name and level), and \`time\` (effort). A four-hour braise is EASIER than a
forty-minute stir fry, not harder. Grade accordingly.

Technique levels: 1 = learned (done it once, following instructions),
2 = practiced (can do it without reading, and recover when it wobbles),
3 = owned (can do it in an unfamiliar kitchen, and teach it).

================================================================================
AMBITION TIERS
================================================================================

WEEKNIGHT — ${AMBITION_RULES.weeknight.summary}

ELEVATED — ${AMBITION_RULES.elevated.summary}

PROJECT — ${AMBITION_RULES.project.summary}

================================================================================
TECHNIQUE LIBRARY — the only legal \`technique_id\` values
================================================================================

${techniqueLibraryBlock()}

================================================================================
NO OVERCLAIMING
================================================================================

${bannedLanguageBlock()}

================================================================================
STEP QUALITY
================================================================================

Every step carries three things that are not optional and are not filler:

- \`doneness_cue\`: what DONE looks, smells or sounds like. Time is a guess; the
  cue is the truth. A step whose doneness can only be described as "when the
  timer goes off" is a badly written step — rewrite it until it has a real cue.
- \`failure_mode\`: how this specific step goes wrong in a real kitchen, and how
  to recover — or an honest statement that you can't.
- \`chef_note\`: the why. The mechanism. This is the lesson hiding inside the
  instruction, and it is the reason the app exists. Food science, not
  encouragement: Maillard, collagen hydrolysis, emulsion, capillary action.

\`can_start_next_step_during\` is the highest-value field in the schema. Home
cooks do not fail on instructions, they fail on parallelism. Set it true
wherever the cook genuinely can start the next step while this one runs, so the
app can say "while the thighs rest, start the sauce."

\`mise_en_place\` lists everything prepped before heat goes on. The app is named
after it — take it seriously.

Write \`plating\` as an instruction a person can follow, and \`leftovers\` as an
honest answer about how the dish holds and how to bring it back.`;
}

/**
 * The system prompt as content blocks, with the prompt-caching breakpoint on
 * the last (and only) stable block. Everything volatile lives in the user turn,
 * after this boundary, so the cache survives from one generation to the next.
 */
export function buildSystemPrompt(): SystemBlock[] {
  return [
    {
      type: 'text',
      text: buildSystemPromptText(),
      cache_control: { type: 'ephemeral' },
    },
  ];
}

// ---------------------------------------------------------------------------
// User prompt — the volatile half
// ---------------------------------------------------------------------------

function bulletList(items: readonly string[], emptyNote: string): string {
  if (items.length === 0) return `  (none — ${emptyNote})`;
  return items.map((i) => `  - ${i}`).join('\n');
}

function exclusionsBlock(exclusions: readonly Exclusion[]): string {
  const active = exclusions.filter((e) => e.enabled);
  if (active.length === 0) {
    return 'No exclusions are active for this cook.';
  }
  const lines = active.map(
    (e) =>
      `  ${e.label} — every one of these terms is banned, including as a ` +
      `substitute, garnish or passing mention:\n    ${e.terms.join(', ')}`,
  );
  return `ABSOLUTE EXCLUSIONS (violating one discards the whole recipe):\n${lines.join('\n')}`;
}

function techniqueProgressBlock(progress: readonly TechniqueProgress[]): string {
  const owned: string[] = [];
  const practiced: string[] = [];
  const learned: string[] = [];

  for (const p of progress) {
    const technique = getTechnique(p.technique_id);
    const name = technique ? `${technique.name} (${p.technique_id})` : p.technique_id;
    if (p.level === 3) owned.push(name);
    else if (p.level === 2) practiced.push(name);
    else if (p.level === 1) learned.push(name);
  }

  if (owned.length === 0 && practiced.length === 0 && learned.length === 0) {
    return `This cook has no recorded technique history yet. Treat everything as new,
pitch at level 1, and introduce at most ONE technique that carries real risk.`;
  }

  return `OWNED (level 3 — can do it in an unfamiliar kitchen, and teach it):
${bulletList(owned, 'nothing owned yet')}

PRACTICED (level 2 — can do it without reading, and recover when it wobbles):
${bulletList(practiced, 'nothing practiced yet')}

LEARNED (level 1 — has done it once, following instructions):
${bulletList(learned, 'nothing learned yet')}

Anything not listed above is LOCKED — never performed. Build on what they
already have, and introduce AT MOST ONE new technique in this recipe. Set each
\`skills_required[].level\` to the level this recipe actually demands, not the
level they happen to be at.`;
}

function calibrationBlock(req: GenerationRequest): string {
  const c = req.calibration;
  if (!c || c.sampleSize === 0) return '';
  const starDirection =
    c.starBias > 0.25
      ? 'They consistently find recipes HARDER than estimated — be conservative, and grade up.'
      : c.starBias < -0.25
        ? 'They consistently find recipes EASIER than estimated — you can push them.'
        : 'Their difficulty estimates track reality well.';
  const timeDirection =
    c.activeMinuteRatio > 1.15
      ? 'They take longer than estimated on hands-on work — budget active minutes generously.'
      : c.activeMinuteRatio < 0.85
        ? 'They work faster than estimated on hands-on work.'
        : 'Their active-time estimates track reality well.';
  return `\nCALIBRATION (from ${c.sampleSize} logged cooks):
  ${starDirection}
  ${timeDirection}\n`;
}

function rejectionsBlock(failures: readonly ValidationFailure[]): string {
  if (failures.length === 0) return '';
  const lines = failures.map((f) => `  - [${f.reason}] ${f.detail}`).join('\n');
  return `
================================================================================
YOUR PREVIOUS ATTEMPT WAS REJECTED
================================================================================

The recipe you just produced was discarded before the cook ever saw it. These
are the exact reasons:

${lines}

Do not resubmit the same dish with cosmetic edits. Fix every listed failure. If
a failure is about an unavailable ingredient, either drop that ingredient
entirely or give it a substitute that is genuinely on the cook's lists. If it is
about an exclusion, the term is banned everywhere in the recipe, not just the
ingredient list — search your own title, pitch, plating, leftovers and chef notes
for it before answering.
`;
}

export interface UserPromptOptions {
  /** Validation failures from the previous attempt, fed back verbatim. */
  previousFailures?: readonly ValidationFailure[];
}

export function buildUserPrompt(
  req: GenerationRequest,
  options: UserPromptOptions = {},
): string {
  const rules = AMBITION_RULES[req.ambition];
  const failures = options.previousFailures ?? [];

  const weeknightLine =
    req.ambition === 'weeknight'
      ? `\n  HARD CEILING: \`time.active_minutes\` must be <= ${req.weeknightActiveMinuteCeiling}.`
      : '';

  return `Generate one recipe for this cook, right now, from what is actually in their
kitchen.

================================================================================
INVENTORY — what they have in the house today
================================================================================
${bulletList(req.inventory, 'the kitchen is empty; lean entirely on pantry staples')}

PANTRY STAPLES — always available, no shopping trip implied
${bulletList(req.pantryStaples, 'no staples declared')}

Anything you use that is not on one of these two lists MUST be marked
\`from_inventory: false\` and MUST carry a \`substitute\` that is on one of them.

================================================================================
${exclusionsBlock(req.exclusions)}
================================================================================

SETTINGS
  Servings: ${req.servings} (set \`servings\` to exactly this)
  Spice tolerance: ${req.spiceTolerance}
  Weeknight active-minute ceiling: ${req.weeknightActiveMinuteCeiling}
${calibrationBlock(req)}
================================================================================
AMBITION FOR THIS RECIPE: ${rules.label.toUpperCase()}
================================================================================

Set \`ambition\` to "${req.ambition}".
${rules.summary}
Target ${rules.starsMin}–${rules.starsMax} stars.${weeknightLine}

================================================================================
THIS COOK'S TECHNIQUE HISTORY
================================================================================

${techniqueProgressBlock(req.techniqueProgress)}
${rejectionsBlock(failures)}
Return the recipe object now.`;
}
