/**
 * Live queries for the cookbook views.
 *
 * `useLiveQuery` re-runs when the underlying tables change, so a cook logged on
 * one screen updates the technique grid on another with no event plumbing.
 * Every one of these goes through `storage.ts` — no component talks to Dexie.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import type { CookLog, DifficultyCalibration, SavedRecipe } from '@contract/types';
import type { FamilyGroup } from './progression';
import {
  cookCountsByRecipe,
  countCooks,
  getCalibration,
  getSavedRecipe,
  getTechniqueGrid,
  listCookLogsFor,
  listSavedRecipes,
  listRecentCookLogs,
} from './storage';
import { NEUTRAL_CALIBRATION } from './calibration';
import { buildTechniqueGrid } from './progression';

/** Undefined while the first query is in flight; every hook below is total. */
export function useSavedRecipes(): SavedRecipe[] {
  return useLiveQuery(() => listSavedRecipes(), [], [] as SavedRecipe[]);
}

export function useSavedRecipe(id: string | null): SavedRecipe | undefined {
  return useLiveQuery(
    () => (id === null ? Promise.resolve(undefined) : getSavedRecipe(id)),
    [id],
    undefined,
  );
}

export function useCookLogsFor(savedRecipeId: string | null): CookLog[] {
  return useLiveQuery(
    () => (savedRecipeId === null ? Promise.resolve([]) : listCookLogsFor(savedRecipeId)),
    [savedRecipeId],
    [] as CookLog[],
  );
}

export function useRecentCookLogs(limit = 20): CookLog[] {
  return useLiveQuery(() => listRecentCookLogs(limit), [limit], [] as CookLog[]);
}

export function useCookCount(): number {
  return useLiveQuery(() => countCooks(), [], 0);
}

export function useCookCountsByRecipe(): ReadonlyMap<string, number> {
  return useLiveQuery(() => cookCountsByRecipe(), [], new Map<string, number>());
}

export function useTechniqueGrid(): FamilyGroup[] {
  return useLiveQuery(() => getTechniqueGrid(), [], buildTechniqueGrid([]));
}

export function useCalibration(): DifficultyCalibration {
  return useLiveQuery(() => getCalibration(), [], NEUTRAL_CALIBRATION);
}
