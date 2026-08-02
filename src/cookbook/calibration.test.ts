import { describe, expect, it } from 'vitest';
import {
  MIN_CALIBRATION_SAMPLE,
  NEUTRAL_CALIBRATION,
  calibrationForGeneration,
  computeCalibration,
  cooksUntilCalibrated,
  describeCalibration,
  isCalibrationApplicable,
  type CalibrationSample,
} from './calibration';

const sample = (
  estimatedStars: number,
  actualStars: number,
  estimatedActiveMinutes: number,
  actualActiveMinutes: number,
): CalibrationSample => ({
  estimatedStars,
  actualStars,
  estimatedActiveMinutes,
  actualActiveMinutes,
});

describe('computeCalibration', () => {
  it('is neutral with no samples', () => {
    const c = computeCalibration([], 500);
    expect(c).toEqual({
      id: 'singleton',
      starBias: 0,
      activeMinuteRatio: 1,
      sampleSize: 0,
      updatedAt: 500,
    });
  });

  it('produces the expected starBias and activeMinuteRatio from known inputs', () => {
    // A cook who finds 3-star recipes like 2-star recipes, and takes half again
    // as long as the estimate says.
    const c = computeCalibration(
      [sample(3, 2, 30, 45), sample(3, 2, 20, 30), sample(4, 3, 40, 60)],
      1,
    );
    expect(c.starBias).toBe(-1);
    expect(c.activeMinuteRatio).toBe(1.5);
    expect(c.sampleSize).toBe(3);
  });

  it('handles a mixed signed bias as a mean, not a majority vote', () => {
    const c = computeCalibration([sample(3, 5, 30, 30), sample(3, 2, 30, 30)], 1);
    expect(c.starBias).toBe(0.5);
    expect(c.activeMinuteRatio).toBe(1);
  });

  it('rounds to three decimals so a mean does not jitter', () => {
    const c = computeCalibration([sample(3, 4, 30, 31), sample(3, 3, 30, 30), sample(3, 3, 30, 30)], 1);
    expect(c.starBias).toBe(0.333);
    expect(c.activeMinuteRatio).toBe(1.011);
  });

  it('excludes zero-estimate samples from the ratio without dropping them from the sample size', () => {
    const c = computeCalibration([sample(3, 3, 0, 12), sample(3, 4, 30, 30)], 1);
    expect(Number.isFinite(c.activeMinuteRatio)).toBe(true);
    expect(c.activeMinuteRatio).toBe(1);
    expect(c.sampleSize).toBe(2);
    expect(c.starBias).toBe(0.5);
  });

  it('falls back to a ratio of 1 when every estimate was zero', () => {
    const c = computeCalibration([sample(2, 2, 0, 10)], 1);
    expect(c.activeMinuteRatio).toBe(1);
  });
});

describe('the sample size gate', () => {
  const withSample = (sampleSize: number) => ({
    ...NEUTRAL_CALIBRATION,
    starBias: -1.5,
    activeMinuteRatio: 1.4,
    sampleSize,
  });

  it('does not apply below the minimum', () => {
    for (let n = 0; n < MIN_CALIBRATION_SAMPLE; n++) {
      expect(isCalibrationApplicable(withSample(n))).toBe(false);
      expect(calibrationForGeneration(withSample(n))).toBeUndefined();
      expect(cooksUntilCalibrated(withSample(n))).toBe(MIN_CALIBRATION_SAMPLE - n);
    }
  });

  it('applies at and above the minimum', () => {
    expect(isCalibrationApplicable(withSample(MIN_CALIBRATION_SAMPLE))).toBe(true);
    expect(calibrationForGeneration(withSample(MIN_CALIBRATION_SAMPLE + 20))).toBeDefined();
    expect(cooksUntilCalibrated(withSample(MIN_CALIBRATION_SAMPLE))).toBe(0);
  });

  it('treats a missing record as no opinion rather than a neutral opinion', () => {
    expect(isCalibrationApplicable(undefined)).toBe(false);
    expect(calibrationForGeneration(undefined)).toBeUndefined();
    expect(cooksUntilCalibrated(undefined)).toBe(MIN_CALIBRATION_SAMPLE);
  });
});

describe('describeCalibration', () => {
  it('is honest about not having enough to go on', () => {
    expect(describeCalibration(undefined)).toMatch(/No cooks logged yet/);
    expect(describeCalibration({ ...NEUTRAL_CALIBRATION, sampleSize: 2 })).toMatch(
      /pitched as written until 5 cooks — 3 to go/,
    );
  });

  it('describes an applied calibration in plain language', () => {
    const text = describeCalibration({
      ...NEUTRAL_CALIBRATION,
      starBias: -1,
      activeMinuteRatio: 1.5,
      sampleSize: 8,
    });
    expect(text).toMatch(/Across 8 cooks/);
    expect(text).toMatch(/easier than estimated/);
    expect(text).toMatch(/50% over the estimate/);
    expect(text).not.toMatch(/streak|points|XP|level up/i);
  });
});
