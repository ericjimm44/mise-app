/**
 * Technique progression — the single source of truth for how cooking a thing
 * turns into knowing a thing.
 *
 * THE THRESHOLDS LIVE HERE AND NOWHERE ELSE. Storage derives levels from
 * `levelForTimesPerformed()`; the UI describes them from `PROGRESSION_RULE`.
 * If a number below changes, every surface changes with it.
 *
 * Level 0 is locked: never performed. Levels 1-3 are the contract's honest
 * ladder — learned, practiced, owned. A cook "owns" a technique after six
 * separate cooks in which they actually performed it, which is a deliberately
 * unhurried number: six is roughly the point at which you stop reading the
 * step before doing it.
 *
 * No points, no streaks, no bonuses. Counting cooks is the whole mechanic.
 */

import { TECHNIQUES, TECHNIQUE_IDS } from '@contract/techniques';
import type {
  Recipe,
  Technique,
  TechniqueFamily,
  TechniqueId,
  TechniqueLevel,
  TechniqueProgress,
} from '@contract/types';

const KNOWN_TECHNIQUES = new Set<TechniqueId>(TECHNIQUE_IDS);

/** 0 = locked. The contract's `TechniqueProgress['level']`, named. */
export type ProgressLevel = 0 | TechniqueLevel;

export interface LevelThreshold {
  level: TechniqueLevel;
  label: 'learned' | 'practiced' | 'owned';
  /** Cooks in which the technique was performed, needed to reach this level. */
  timesRequired: number;
}

/** Ascending. The only place these numbers appear. */
export const LEVEL_THRESHOLDS: readonly LevelThreshold[] = Object.freeze([
  { level: 1, label: 'learned', timesRequired: 1 },
  { level: 2, label: 'practiced', timesRequired: 3 },
  { level: 3, label: 'owned', timesRequired: 6 },
] as const);

/** Human-readable statement of the rule, rendered in the UI. Derived, not retyped. */
export const PROGRESSION_RULE = LEVEL_THRESHOLDS.map(
  (t) => `${t.label} after ${t.timesRequired === 1 ? 'one cook' : `${t.timesRequired} cooks`}`,
).join(', ');

export const LEVEL_LABELS: Readonly<Record<ProgressLevel, string>> = Object.freeze({
  0: 'not yet cooked',
  1: 'learned',
  2: 'practiced',
  3: 'owned',
});

/** Display order for the grid. Heat first because heat is where dinner is won. */
export const FAMILY_ORDER: readonly TechniqueFamily[] = Object.freeze([
  'heat',
  'knife',
  'protein',
  'vegetable',
  'egg',
  'dough',
  'sauce',
  'seasoning',
  'finishing',
] as const);

export const FAMILY_LABELS: Readonly<Record<TechniqueFamily, string>> = Object.freeze({
  heat: 'Heat',
  knife: 'Knife',
  protein: 'Protein',
  vegetable: 'Vegetables',
  egg: 'Eggs',
  dough: 'Dough',
  sauce: 'Sauce',
  seasoning: 'Seasoning',
  finishing: 'Finishing',
});

/** The level earned by having performed a technique `times` times. */
export function levelForTimesPerformed(times: number): ProgressLevel {
  let level: ProgressLevel = 0;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (times >= threshold.timesRequired) level = threshold.level;
  }
  return level;
}

/** Cooks still needed to reach the next level, or null at `owned`. */
export function cooksUntilNextLevel(times: number): number | null {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (times < threshold.timesRequired) return threshold.timesRequired - times;
  }
  return null;
}

/** A locked row for a technique that has never been performed. */
export function lockedProgress(technique_id: TechniqueId): TechniqueProgress {
  return {
    technique_id,
    level: 0,
    timesPerformed: 0,
    firstPerformedAt: null,
    lastPerformedAt: null,
  };
}

/**
 * Fold one cook into an existing progress row. Pure — storage persists the
 * result, tests assert on it directly.
 */
export function recordPerformance(
  existing: TechniqueProgress | undefined,
  technique_id: TechniqueId,
  performedAt: number,
): TechniqueProgress {
  const base = existing ?? lockedProgress(technique_id);
  const timesPerformed = base.timesPerformed + 1;
  return {
    technique_id,
    timesPerformed,
    level: levelForTimesPerformed(timesPerformed),
    firstPerformedAt: base.firstPerformedAt ?? performedAt,
    lastPerformedAt: Math.max(base.lastPerformedAt ?? 0, performedAt),
  };
}

/**
 * Every technique a recipe teaches, in the order the cook meets them: the
 * declared skill requirements first, then anything a step introduces on its
 * own. This is what the post-cook form offers to tick off, so it must come
 * from the recipe rather than from a hand-maintained list.
 *
 * Unknown ids are dropped here rather than thrown on: a recipe is model output,
 * and the generator's validation has already rejected the ones that matter.
 */
export function techniquesInRecipe(recipe: Recipe): TechniqueId[] {
  const ids: TechniqueId[] = [];
  for (const skill of recipe.skills_required) ids.push(skill.technique_id);
  for (const step of recipe.steps) if (step.technique_id) ids.push(step.technique_id);
  return [...new Set(ids)].filter((id) => KNOWN_TECHNIQUES.has(id));
}

/** One cook, reduced to what progression cares about. */
export interface PerformanceRecord {
  cookedAt: number;
  techniquesPerformed: readonly TechniqueId[];
}

/**
 * Rebuild every progress row from scratch out of the full cook history. Used
 * after an import or a deletion, where incremental updates cannot be trusted.
 * Techniques never performed are simply absent — the grid fills them in as
 * locked rather than storing forty empty rows.
 */
export function rebuildProgressFromCooks(
  cooks: readonly PerformanceRecord[],
): TechniqueProgress[] {
  const byId = new Map<TechniqueId, TechniqueProgress>();
  const ordered = [...cooks].sort((a, b) => a.cookedAt - b.cookedAt);
  for (const cook of ordered) {
    for (const id of new Set(cook.techniquesPerformed)) {
      byId.set(id, recordPerformance(byId.get(id), id, cook.cookedAt));
    }
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

export interface TechniqueStanding {
  technique: Technique;
  progress: TechniqueProgress;
  /** Null once owned. */
  cooksToNext: number | null;
}

export interface FamilyGroup {
  family: TechniqueFamily;
  label: string;
  techniques: readonly TechniqueStanding[];
  /** Techniques in this family at level 3. */
  ownedCount: number;
  /** Techniques in this family the cook has performed at least once. */
  startedCount: number;
}

/**
 * All 40 techniques, grouped by family, locked ones included. The grid is a
 * complete map of the territory — seeing what you have not cooked yet is half
 * the point, so nothing is filtered out.
 */
export function buildTechniqueGrid(rows: readonly TechniqueProgress[]): FamilyGroup[] {
  const byId = new Map(rows.map((r) => [r.technique_id, r]));

  return FAMILY_ORDER.map((family) => {
    const techniques: TechniqueStanding[] = TECHNIQUES.filter((t) => t.family === family).map(
      (technique) => {
        const progress = byId.get(technique.technique_id) ?? lockedProgress(technique.technique_id);
        return {
          technique,
          progress,
          cooksToNext: cooksUntilNextLevel(progress.timesPerformed),
        };
      },
    );

    return {
      family,
      label: FAMILY_LABELS[family],
      techniques,
      ownedCount: techniques.filter((t) => t.progress.level === 3).length,
      startedCount: techniques.filter((t) => t.progress.timesPerformed > 0).length,
    };
  });
}

/** One plain sentence about a technique's standing. No exclamation marks. */
export function describeStanding(standing: TechniqueStanding): string {
  const { timesPerformed, level } = standing.progress;
  if (timesPerformed === 0) return 'Not yet cooked.';
  const cooks = timesPerformed === 1 ? 'once' : timesPerformed === 2 ? 'twice' : `${timesPerformed} times`;
  const next = standing.cooksToNext;
  if (next === null) return `Cooked ${cooks}. Owned.`;
  const nextLabel = LEVEL_THRESHOLDS.find((t) => t.level === level + 1)?.label ?? 'the next level';
  const more = next === 1 ? 'One more cook' : `${next} more cooks`;
  return `Cooked ${cooks}. ${LEVEL_LABELS[level]}. ${more} to ${nextLabel}.`;
}
