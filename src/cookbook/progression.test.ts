import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '@contract/techniques';
import type { TechniqueProgress } from '@contract/types';
import {
  FAMILY_ORDER,
  LEVEL_THRESHOLDS,
  PROGRESSION_RULE,
  buildTechniqueGrid,
  cooksUntilNextLevel,
  describeStanding,
  levelForTimesPerformed,
  lockedProgress,
  rebuildProgressFromCooks,
  recordPerformance,
} from './progression';

describe('level thresholds', () => {
  it('maps cook counts to levels at the documented boundaries', () => {
    expect(levelForTimesPerformed(0)).toBe(0);
    expect(levelForTimesPerformed(1)).toBe(1);
    expect(levelForTimesPerformed(2)).toBe(1);
    expect(levelForTimesPerformed(3)).toBe(2);
    expect(levelForTimesPerformed(5)).toBe(2);
    expect(levelForTimesPerformed(6)).toBe(3);
    expect(levelForTimesPerformed(60)).toBe(3);
  });

  it('agrees with the single table it is derived from', () => {
    for (const threshold of LEVEL_THRESHOLDS) {
      expect(levelForTimesPerformed(threshold.timesRequired)).toBe(threshold.level);
      expect(levelForTimesPerformed(threshold.timesRequired - 1)).toBeLessThan(threshold.level);
    }
    expect(PROGRESSION_RULE).toBe('learned after one cook, practiced after 3 cooks, owned after 6 cooks');
  });

  it('counts down to the next level and stops at owned', () => {
    expect(cooksUntilNextLevel(0)).toBe(1);
    expect(cooksUntilNextLevel(1)).toBe(2);
    expect(cooksUntilNextLevel(3)).toBe(3);
    expect(cooksUntilNextLevel(6)).toBeNull();
  });
});

describe('recordPerformance', () => {
  it('opens a locked technique on the first cook', () => {
    const progress = recordPerformance(undefined, 'pan_sauce', 500);
    expect(progress).toEqual<TechniqueProgress>({
      technique_id: 'pan_sauce',
      level: 1,
      timesPerformed: 1,
      firstPerformedAt: 500,
      lastPerformedAt: 500,
    });
  });

  it('keeps the first timestamp and advances the last', () => {
    const first = recordPerformance(undefined, 'pan_sauce', 500);
    const second = recordPerformance(first, 'pan_sauce', 900);
    expect(second.firstPerformedAt).toBe(500);
    expect(second.lastPerformedAt).toBe(900);
    expect(second.timesPerformed).toBe(2);
    expect(second.level).toBe(1);
  });

  it('does not move lastPerformedAt backwards for a back-dated cook', () => {
    const first = recordPerformance(undefined, 'pan_sauce', 900);
    const backdated = recordPerformance(first, 'pan_sauce', 100);
    expect(backdated.firstPerformedAt).toBe(900);
    expect(backdated.lastPerformedAt).toBe(900);
  });

  it('does not mutate the row it was given', () => {
    const first = lockedProgress('pan_sauce');
    recordPerformance(first, 'pan_sauce', 500);
    expect(first.timesPerformed).toBe(0);
    expect(first.level).toBe(0);
  });
});

describe('rebuildProgressFromCooks', () => {
  it('reproduces levels from a full history regardless of input order', () => {
    const rows = rebuildProgressFromCooks([
      { cookedAt: 300, techniquesPerformed: ['maillard_sear', 'pan_sauce'] },
      { cookedAt: 100, techniquesPerformed: ['maillard_sear'] },
      { cookedAt: 200, techniquesPerformed: ['maillard_sear'] },
    ]);

    const byId = new Map(rows.map((r) => [r.technique_id, r]));
    expect(byId.get('maillard_sear')).toMatchObject({
      timesPerformed: 3,
      level: 2,
      firstPerformedAt: 100,
      lastPerformedAt: 300,
    });
    expect(byId.get('pan_sauce')).toMatchObject({ timesPerformed: 1, level: 1 });
  });

  it('stores nothing for techniques never performed', () => {
    expect(rebuildProgressFromCooks([])).toEqual([]);
    expect(
      rebuildProgressFromCooks([{ cookedAt: 1, techniquesPerformed: [] }]),
    ).toEqual([]);
  });

  it('counts a technique once per cook even when repeated in one log', () => {
    const [row] = rebuildProgressFromCooks([
      { cookedAt: 1, techniquesPerformed: ['roux', 'roux', 'roux'] },
    ]);
    expect(row!.timesPerformed).toBe(1);
  });
});

describe('the grid', () => {
  it('covers all 40 techniques, grouped by family, locked ones included', () => {
    const grid = buildTechniqueGrid([]);
    expect(grid.map((g) => g.family)).toEqual([...FAMILY_ORDER]);

    const all = grid.flatMap((g) => g.techniques);
    expect(all).toHaveLength(TECHNIQUES.length);
    expect(all).toHaveLength(40);
    expect(new Set(all.map((t) => t.technique.technique_id)).size).toBe(40);
    expect(all.every((t) => t.progress.level === 0)).toBe(true);
    expect(grid.every((g) => g.ownedCount === 0 && g.startedCount === 0)).toBe(true);
  });

  it('renders the empty video slot honestly — every technique has a null videoUrl', () => {
    const all = buildTechniqueGrid([]).flatMap((g) => g.techniques);
    expect(all.every((t) => t.technique.videoUrl === null)).toBe(true);
  });

  it('counts owned and started per family', () => {
    const grid = buildTechniqueGrid([
      {
        technique_id: 'maillard_sear',
        level: 3,
        timesPerformed: 7,
        firstPerformedAt: 1,
        lastPerformedAt: 9,
      },
      {
        technique_id: 'braise',
        level: 1,
        timesPerformed: 1,
        firstPerformedAt: 2,
        lastPerformedAt: 2,
      },
    ]);

    const heat = grid.find((g) => g.family === 'heat')!;
    expect(heat.ownedCount).toBe(1);
    expect(heat.startedCount).toBe(2);
    expect(grid.find((g) => g.family === 'sauce')!.ownedCount).toBe(0);
  });
});

describe('describeStanding', () => {
  const standing = (timesPerformed: number) => {
    const grid = buildTechniqueGrid(
      timesPerformed === 0
        ? []
        : [
            {
              technique_id: 'maillard_sear',
              level: levelForTimesPerformed(timesPerformed),
              timesPerformed,
              firstPerformedAt: 1,
              lastPerformedAt: 2,
            },
          ],
    );
    return grid
      .flatMap((g) => g.techniques)
      .find((t) => t.technique.technique_id === 'maillard_sear')!;
  };

  it('states the position plainly, with no points or streaks', () => {
    expect(describeStanding(standing(0))).toBe('Not yet cooked.');
    expect(describeStanding(standing(1))).toBe('Cooked once. learned. 2 more cooks to practiced.');
    expect(describeStanding(standing(5))).toBe('Cooked 5 times. practiced. One more cook to owned.');
    expect(describeStanding(standing(6))).toBe('Cooked 6 times. Owned.');
  });
});
