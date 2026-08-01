import { describe, expect, it } from 'vitest';
import { BANNED_CLAIM_PATTERNS, DEFAULT_EXCLUSIONS } from '@contract/recipe.schema';
import { TECHNIQUE_IDS } from '@contract/techniques';
import type { Exclusion } from '@contract/types';
import { AMBITION_RULES, buildSystemPrompt, buildSystemPromptText, buildUserPrompt } from './prompt';
import { baseRequest, INVENTORY, PANTRY_STAPLES } from './test-fixtures';

describe('buildSystemPrompt', () => {
  const text = buildSystemPromptText();

  it('is a single stable block carrying the prompt-cache breakpoint', () => {
    const blocks = buildSystemPrompt();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('is byte-identical between calls, so the cached prefix survives', () => {
    expect(buildSystemPromptText()).toBe(text);
  });

  it('lists every technique id, so the model cannot invent one', () => {
    for (const id of TECHNIQUE_IDS) {
      expect(text).toContain(id);
    }
  });

  it('encodes the star rubric rather than letting the model freelance difficulty', () => {
    expect(text).toContain('1 star');
    expect(text).toContain('5 stars');
    expect(text).toContain('Multi-day, multi-component, or equipment most homes lack');
    expect(text).toContain('difficulty.rationale');
  });

  it('encodes all three ambition tiers as constraints', () => {
    expect(text).toContain(AMBITION_RULES.weeknight.summary);
    expect(text).toContain(AMBITION_RULES.elevated.summary);
    expect(text).toContain(AMBITION_RULES.project.summary);
  });

  it('states the four validation rules the contract enforces', () => {
    expect(text).toContain('from_inventory');
    expect(text).toContain('substitute');
    expect(text).toContain('EXCLUSIONS ARE ABSOLUTE');
    expect(text).toContain('TECHNIQUE IDS MUST EXIST');
    expect(text).toContain('TIME MUST BE INTERNALLY CONSISTENT');
  });

  it('names the derived products that trip up every other app', () => {
    for (const derived of ['fish sauce', 'oyster sauce', 'Worcestershire', 'dashi', 'bottarga']) {
      expect(text).toContain(derived);
    }
  });

  it('forbids overclaim language and quotes the actual validator patterns', () => {
    for (const pattern of BANNED_CLAIM_PATTERNS) {
      expect(text).toContain(pattern.toString());
    }
    expect(text).toContain('NAME THE TECHNIQUE');
  });

  it('does not itself trip the overclaim validator', () => {
    // The prompt quotes the banned patterns as regex literals on purpose, so
    // the plain-English gloss is checked separately from the pattern list.
    const gloss = text.split('In practice:')[1] ?? '';
    expect(gloss.length).toBeGreaterThan(0);
    expect(gloss).toContain('never write');
  });

  it('insists on the three per-step teaching fields', () => {
    expect(text).toContain('doneness_cue');
    expect(text).toContain('failure_mode');
    expect(text).toContain('chef_note');
    expect(text).toContain('can_start_next_step_during');
    expect(text).toContain('mise_en_place');
  });
});

describe('buildUserPrompt', () => {
  it('lists the inventory and pantry staples explicitly', () => {
    const prompt = buildUserPrompt(baseRequest());
    for (const item of INVENTORY) {
      expect(prompt).toContain(item);
    }
    for (const staple of PANTRY_STAPLES) {
      expect(prompt).toContain(staple);
    }
    expect(prompt).toContain('MUST carry a `substitute` that is on one of them');
  });

  it('states exclusions as absolute and spells out every banned term', () => {
    const prompt = buildUserPrompt(baseRequest());
    expect(prompt).toContain('ABSOLUTE EXCLUSIONS');
    expect(prompt).toContain('Seafood');
    // The category name is not enough — the derived products are the trap.
    for (const term of ['fish sauce', 'oyster sauce', 'worcestershire', 'dashi', 'katsuobushi']) {
      expect(prompt).toContain(term);
    }
  });

  it('omits disabled exclusions', () => {
    const prompt = buildUserPrompt(baseRequest());
    // Pork and peanuts are seeded but disabled by default.
    expect(prompt).not.toContain('Peanuts');
    expect(prompt).not.toContain('Tree nuts');
  });

  it('says so plainly when no exclusion is active', () => {
    const none: readonly Exclusion[] = DEFAULT_EXCLUSIONS.map((e) => ({ ...e, enabled: false }));
    const prompt = buildUserPrompt(baseRequest({ exclusions: none }));
    expect(prompt).toContain('No exclusions are active');
  });

  it('carries the settings the recipe has to honour', () => {
    const prompt = buildUserPrompt(baseRequest({ servings: 4, spiceTolerance: 'hot' }));
    expect(prompt).toContain('Servings: 4');
    expect(prompt).toContain('Spice tolerance: hot');
  });

  it('turns the weeknight ceiling into a hard ceiling on active minutes', () => {
    const prompt = buildUserPrompt(
      baseRequest({ ambition: 'weeknight', weeknightActiveMinuteCeiling: 25 }),
    );
    expect(prompt).toContain('WEEKNIGHT');
    expect(prompt).toContain('HARD CEILING');
    expect(prompt).toContain('`time.active_minutes` must be <= 25');
    expect(prompt).toContain('Target 1–3 stars');
  });

  it('asks Elevated for an unowned technique at 3–4 stars', () => {
    const prompt = buildUserPrompt(baseRequest({ ambition: 'elevated' }));
    expect(prompt).toContain('ELEVATED');
    expect(prompt).toContain('Set `ambition` to "elevated"');
    expect(prompt).toContain('Target 3–4 stars');
    expect(prompt).not.toContain('HARD CEILING');
  });

  it('lets Project spend passive time at 4–5 stars', () => {
    const prompt = buildUserPrompt(baseRequest({ ambition: 'project' }));
    expect(prompt).toContain('PROJECT');
    expect(prompt).toContain('Target 4–5 stars');
    expect(prompt).toContain('Multi-component or multi-day');
  });

  it('pitches at the cook by naming what they own, practice and have merely learned', () => {
    const prompt = buildUserPrompt(baseRequest());
    expect(prompt).toContain('OWNED (level 3');
    expect(prompt).toContain('Maillard sear (maillard_sear)');
    expect(prompt).toContain('Sweating aromatics (sweat_aromatics)');
    expect(prompt).toContain('Pan sauce / fond deglaze (pan_sauce)');
    expect(prompt).toContain('AT MOST ONE new technique');
  });

  it('handles a cook with no technique history', () => {
    const prompt = buildUserPrompt(baseRequest({ techniqueProgress: [] }));
    expect(prompt).toContain('no recorded technique history');
    expect(prompt).toContain('pitch at level 1');
  });

  it('includes calibration only when there are logged cooks to calibrate from', () => {
    const withCalibration = buildUserPrompt(
      baseRequest({
        calibration: {
          id: 'singleton',
          starBias: 0.8,
          activeMinuteRatio: 1.4,
          sampleSize: 6,
          updatedAt: 0,
        },
      }),
    );
    expect(withCalibration).toContain('CALIBRATION (from 6 logged cooks)');
    expect(withCalibration).toContain('HARDER than estimated');
    expect(withCalibration).toContain('budget active minutes generously');

    const empty = buildUserPrompt(
      baseRequest({
        calibration: {
          id: 'singleton',
          starBias: 0,
          activeMinuteRatio: 1,
          sampleSize: 0,
          updatedAt: 0,
        },
      }),
    );
    expect(empty).not.toContain('CALIBRATION');
  });

  it('has no rejection section on a first attempt', () => {
    const prompt = buildUserPrompt(baseRequest());
    expect(prompt).not.toContain('YOUR PREVIOUS ATTEMPT WAS REJECTED');
  });

  it('feeds specific failure details back verbatim on a retry', () => {
    const prompt = buildUserPrompt(baseRequest(), {
      previousFailures: [
        {
          reason: 'unavailable_ingredient_without_substitute',
          detail: '"shallot" is not in inventory and has no substitute — this is a shopping trip',
        },
        {
          reason: 'exclusion_violation',
          detail: 'Exclusion "Seafood" violated by term "fish sauce" in: "fish sauce"',
        },
      ],
    });

    expect(prompt).toContain('YOUR PREVIOUS ATTEMPT WAS REJECTED');
    expect(prompt).toContain('[unavailable_ingredient_without_substitute]');
    expect(prompt).toContain('"shallot" is not in inventory and has no substitute');
    expect(prompt).toContain('[exclusion_violation]');
    expect(prompt).toContain('fish sauce');
    // "Try again" produces the same recipe; this is the instruction that doesn't.
    expect(prompt).toContain('Do not resubmit the same dish with cosmetic edits');
  });
});
