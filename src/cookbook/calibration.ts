/**
 * Difficulty calibration — the app adjusting to the cook rather than the cook
 * adjusting to the app.
 *
 * Two signals, both signed against the recipe's own estimate:
 *   starBias          mean of (actual stars - estimated stars)
 *   activeMinuteRatio mean of (actual active minutes / estimated active minutes)
 *
 * A cook who keeps finding 3-star recipes easy accumulates a negative
 * `starBias`, and Agent A pitches harder. A cook who takes half again as long
 * as the recipe claims gets a ratio above 1, and time estimates stop lying.
 *
 * THE SAMPLE SIZE GATE IS THE IMPORTANT PART. One data point is noise: one bad
 * evening, one recipe that was genuinely mis-rated. Reshaping the whole app off
 * it is worse than not adjusting at all. Below MIN_CALIBRATION_SAMPLE the
 * numbers are still recorded — they are just not handed to the generator.
 */

import type { DifficultyCalibration } from '@contract/types';
import { SINGLETON_ID } from '@contract/db';

/**
 * Cooks required before calibration is allowed to influence generation.
 *
 * Five, matching the Definition-of-Done horizon ("after five cooks..."): it is
 * the smallest number at which a consistent bias is distinguishable from one
 * unusual evening.
 */
export const MIN_CALIBRATION_SAMPLE = 5;

/** No opinion yet. Not written to Dexie until there is at least one cook. */
export const NEUTRAL_CALIBRATION: DifficultyCalibration = Object.freeze({
  id: SINGLETON_ID,
  starBias: 0,
  activeMinuteRatio: 1,
  sampleSize: 0,
  updatedAt: 0,
});

/** One cooked recipe: what it claimed, and what it actually was. */
export interface CalibrationSample {
  estimatedStars: number;
  actualStars: number;
  estimatedActiveMinutes: number;
  actualActiveMinutes: number;
}

/** Three decimals. Enough resolution to steer with, not enough to jitter. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Compute calibration across the full cook history. Always a full recompute:
 * an incremental mean drifts, and the history is a few dozen rows.
 *
 * Samples whose estimated active minutes are zero contribute to `starBias` and
 * to `sampleSize` but not to `activeMinuteRatio` — dividing by zero would
 * produce an Infinity that poisons the mean forever.
 */
export function computeCalibration(
  samples: readonly CalibrationSample[],
  now: number = Date.now(),
): DifficultyCalibration {
  if (samples.length === 0) {
    return { ...NEUTRAL_CALIBRATION, updatedAt: now };
  }

  let starErrorTotal = 0;
  let ratioTotal = 0;
  let ratioCount = 0;

  for (const s of samples) {
    starErrorTotal += s.actualStars - s.estimatedStars;
    if (s.estimatedActiveMinutes > 0) {
      ratioTotal += s.actualActiveMinutes / s.estimatedActiveMinutes;
      ratioCount += 1;
    }
  }

  return {
    id: SINGLETON_ID,
    starBias: round3(starErrorTotal / samples.length),
    activeMinuteRatio: ratioCount > 0 ? round3(ratioTotal / ratioCount) : 1,
    sampleSize: samples.length,
    updatedAt: now,
  };
}

/** Has enough been observed to act on? */
export function isCalibrationApplicable(
  calibration: DifficultyCalibration | undefined,
): calibration is DifficultyCalibration {
  return calibration !== undefined && calibration.sampleSize >= MIN_CALIBRATION_SAMPLE;
}

/**
 * What Agent A should put on `GenerationRequest.calibration`: the record when
 * it has earned the right to be applied, and `undefined` otherwise. Returning
 * `undefined` rather than a neutral record is deliberate — the generator can
 * then tell "no opinion" from "an opinion that happens to be zero".
 */
export function calibrationForGeneration(
  calibration: DifficultyCalibration | undefined,
): DifficultyCalibration | undefined {
  return isCalibrationApplicable(calibration) ? calibration : undefined;
}

/** Cooks still needed before calibration starts being applied. */
export function cooksUntilCalibrated(calibration: DifficultyCalibration | undefined): number {
  return Math.max(0, MIN_CALIBRATION_SAMPLE - (calibration?.sampleSize ?? 0));
}

/**
 * Plain-language summary for the cookbook. States the sample size honestly,
 * including when it is too small to be used.
 */
export function describeCalibration(calibration: DifficultyCalibration | undefined): string {
  const c = calibration ?? NEUTRAL_CALIBRATION;
  if (c.sampleSize === 0) return 'No cooks logged yet, so recipes are pitched as written.';

  const cooks = c.sampleSize === 1 ? '1 cook' : `${c.sampleSize} cooks`;
  if (!isCalibrationApplicable(c)) {
    const remaining = cooksUntilCalibrated(c);
    return `${cooks} logged. Recipes are pitched as written until ${MIN_CALIBRATION_SAMPLE} cooks — ${remaining} to go.`;
  }

  const stars = describeStarBias(c.starBias);
  const time = describeTimeRatio(c.activeMinuteRatio);
  return `Across ${cooks}: ${stars} ${time}`;
}

function describeStarBias(bias: number): string {
  if (Math.abs(bias) < 0.25) return 'difficulty estimates land about right.';
  const amount = Math.abs(bias) >= 0.75 ? 'a good deal' : 'slightly';
  return bias < 0
    ? `recipes come out ${amount} easier than estimated, so harder ones are suggested.`
    : `recipes come out ${amount} harder than estimated, so gentler ones are suggested.`;
}

function describeTimeRatio(ratio: number): string {
  if (Math.abs(ratio - 1) < 0.1) return 'Active time estimates are close.';
  const pct = Math.round(Math.abs(ratio - 1) * 100);
  return ratio > 1
    ? `Hands-on time runs about ${pct}% over the estimate.`
    : `Hands-on time runs about ${pct}% under the estimate.`;
}
