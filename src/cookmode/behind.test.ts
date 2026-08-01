/**
 * "I'm behind" classification.
 *
 * The judgment is heuristic and the tests treat it as such: they assert the
 * VERDICT (does this hold or not) and the presence of advice, not the exact
 * prose. What is not negotiable is that every entry gets a verdict, a reason
 * and — when it cannot wait — something to actually do. Silence is the failure
 * mode this whole feature exists to avoid.
 */

import { describe, expect, it } from 'vitest';
import type { RecipeStep } from '@contract/types';
import { BEHIND_CAVEAT, buildBehindReport, classifyHold, holding, notHolding } from './behind';
import { PROVE, REST, SAUCE, SEAR } from './fixtures';

function step(overrides: Partial<RecipeStep>): RecipeStep {
  return { ...REST, ...overrides };
}

describe('classifyHold', () => {
  it('an active step cannot wait', () => {
    const verdict = classifyHold({
      step: SEAR,
      timerId: 't1',
      timerType: 'active',
      label: SEAR.title,
    });
    expect(verdict.holds).toBe(false);
    expect(verdict.risk).toBe('needs_attention');
    expect(verdict.advice).toMatch(/\S/);
  });

  it('a passive step holds — waiting is what it is doing anyway', () => {
    const verdict = classifyHold({
      step: REST,
      timerId: 't2',
      timerType: 'passive',
      label: REST.title,
    });
    expect(verdict.holds).toBe(true);
    expect(verdict.risk).toBe('holds');
    // Even the good news comes with an instruction rather than a shrug.
    expect(verdict.advice).toMatch(/\S/);
  });

  it('a passive step that OVERSHOOTS does not hold, whatever its timer type says', () => {
    // A prove is passive, but it keeps going without you. "It's only resting"
    // is not true of a proof, a brine or a marinade.
    const verdict = classifyHold({
      step: PROVE,
      timerId: 't3',
      timerType: 'passive',
      label: PROVE.title,
    });
    expect(verdict.holds).toBe(false);
    expect(verdict.risk).toBe('overshoots');
    expect(verdict.advice).toMatch(/heat|oven|fridge/i);
  });

  it('reads the failure mode when the timer type alone would say "fine"', () => {
    // Passive on paper; its own failure mode says otherwise.
    const emulsion = step({
      id: 'held-sauce',
      timer_type: 'passive',
      failure_mode: 'Left sitting, the emulsion breaks and separates into oil and water.',
    });
    const verdict = classifyHold({
      step: emulsion,
      timerId: null,
      timerType: 'passive',
      label: 'Hold the sauce',
    });
    expect(verdict.holds).toBe(false);
    expect(verdict.risk).toBe('needs_attention');
  });

  it('falls back to the step’s declared timer type when no timer is running', () => {
    const verdict = classifyHold({
      step: SAUCE,
      timerId: null,
      timerType: null,
      label: SAUCE.title,
    });
    expect(verdict.timerType).toBe('active');
    expect(verdict.holds).toBe(false);
  });

  it('holds a step with no timer and a benign failure mode', () => {
    const benign = step({
      id: 'chop',
      timer_seconds: null,
      timer_type: null,
      failure_mode: 'Uneven pieces cook at different rates and the texture is inconsistent.',
    });
    const verdict = classifyHold({
      step: benign,
      timerId: null,
      timerType: null,
      label: 'Chop the shallot',
    });
    expect(verdict.holds).toBe(true);
  });

  it('always surfaces the step’s own words so the cook can overrule us', () => {
    for (const s of [SEAR, REST, SAUCE, PROVE]) {
      const verdict = classifyHold({ step: s, timerId: null, timerType: null, label: s.title });
      expect(verdict.failureMode).toBe(s.failure_mode);
      expect(verdict.reason).toMatch(/\S/);
    }
  });
});

describe('buildBehindReport', () => {
  it('splits the list and names the urgent ones in the summary', () => {
    const report = buildBehindReport(
      [
        { step: SEAR, timerId: 't1', timerType: 'active', label: SEAR.title },
        { step: REST, timerId: 't2', timerType: 'passive', label: REST.title },
        { step: PROVE, timerId: 't3', timerType: 'passive', label: PROVE.title },
      ],
      ['t1', 't2', 't3'],
      1000,
    );

    expect(notHolding(report).map((v) => v.label)).toEqual([SEAR.title, PROVE.title]);
    expect(holding(report).map((v) => v.label)).toEqual([REST.title]);
    expect(report.summary).toContain(SEAR.title);
    expect(report.summary).toContain(PROVE.title);
    expect(report.summary).toContain(REST.title);
    expect(report.pausedByBehind).toEqual(['t1', 't2', 't3']);
    expect(report.at).toBe(1000);
  });

  it('says so plainly when everything holds', () => {
    const report = buildBehindReport(
      [{ step: REST, timerId: 't2', timerType: 'passive', label: REST.title }],
      ['t2'],
      0,
    );
    expect(notHolding(report)).toHaveLength(0);
    expect(report.summary).toMatch(/hold/i);
  });

  it('is never empty-handed, even with nothing running', () => {
    const report = buildBehindReport([], [], 0);
    expect(report.summary).toMatch(/\S/);
    expect(report.caveat).toBe(BEHIND_CAVEAT);
  });

  it('always admits the judgment is a judgment', () => {
    const report = buildBehindReport(
      [{ step: SAUCE, timerId: 't1', timerType: 'active', label: SAUCE.title }],
      ['t1'],
      0,
    );
    expect(report.caveat).toMatch(/judgment/i);
    // ...and that the cue still outranks it.
    expect(report.caveat).toMatch(/cue/i);
  });
});
