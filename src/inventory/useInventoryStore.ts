/**
 * The one place components get inventory state from.
 *
 * Reads and writes go through `InventoryRepository`, never Dexie — including
 * here. There is no `useLiveQuery` in this module on purpose: binding the UI to
 * Dexie's change feed would couple components to the storage engine, and the
 * whole point of the boundary is that Agent D can replace it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exclusion, InventoryItem, PantryStaple, UserSettings } from '@contract/types';
import type {
  CustomExclusionDraft,
  InventoryDraft,
  InventoryRepository,
  SettingsPatch,
} from './storage';
import { inventoryRepository } from './storage';

export interface InventoryStore {
  ready: boolean;
  error: string | null;
  inventory: readonly InventoryItem[];
  staples: readonly PantryStaple[];
  exclusions: readonly Exclusion[];
  settings: UserSettings | null;

  addItems: (drafts: readonly InventoryDraft[]) => Promise<void>;
  updateItem: (id: string, patch: Partial<InventoryDraft>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearInventory: () => Promise<void>;

  setStapleEnabled: (id: string, enabled: boolean) => Promise<void>;
  addStaple: (name: string) => Promise<void>;
  removeStaple: (id: string) => Promise<void>;

  setExclusionEnabled: (id: string, enabled: boolean) => Promise<void>;
  addExclusion: (draft: CustomExclusionDraft) => Promise<void>;
  updateExclusionTerms: (id: string, terms: readonly string[]) => Promise<void>;
  removeExclusion: (id: string) => Promise<void>;

  updateSettings: (patch: SettingsPatch) => Promise<void>;
}

export function useInventoryStore(
  repository: InventoryRepository = inventoryRepository,
): InventoryStore {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<readonly InventoryItem[]>([]);
  const [staples, setStaples] = useState<readonly PantryStaple[]>([]);
  const [exclusions, setExclusions] = useState<readonly Exclusion[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const [nextInventory, nextStaples, nextExclusions, nextSettings] = await Promise.all([
      repository.listInventory(),
      repository.listPantryStaples(),
      repository.listExclusions(),
      repository.getSettings(),
    ]);
    if (!mounted.current) return;
    setInventory(nextInventory);
    setStaples(nextStaples);
    setExclusions(nextExclusions);
    setSettings(nextSettings);
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await repository.ensureSeeded();
        if (cancelled) return;
        await refresh();
      } catch (cause) {
        if (!cancelled && mounted.current) {
          setError(cause instanceof Error ? cause.message : 'Could not open local storage.');
        }
      } finally {
        if (!cancelled && mounted.current) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, refresh]);

  /** Every mutation goes through here, so no action can forget to re-read. */
  const run = useCallback(
    async (mutate: () => Promise<unknown>) => {
      try {
        await mutate();
        await refresh();
        if (mounted.current) setError(null);
      } catch (cause) {
        if (mounted.current) {
          setError(cause instanceof Error ? cause.message : 'That change could not be saved.');
        }
      }
    },
    [refresh],
  );

  return useMemo<InventoryStore>(
    () => ({
      ready,
      error,
      inventory,
      staples,
      exclusions,
      settings,

      addItems: (drafts) => run(() => repository.addInventoryItems(drafts)),
      updateItem: (id, patch) => run(() => repository.updateInventoryItem(id, patch)),
      removeItem: (id) => run(() => repository.removeInventoryItem(id)),
      clearInventory: () => run(() => repository.clearInventory()),

      setStapleEnabled: (id, enabled) => run(() => repository.setPantryStapleEnabled(id, enabled)),
      addStaple: (name) => run(() => repository.addCustomPantryStaple(name)),
      removeStaple: (id) => run(() => repository.removePantryStaple(id)),

      setExclusionEnabled: (id, enabled) => run(() => repository.setExclusionEnabled(id, enabled)),
      addExclusion: (draft) => run(() => repository.addCustomExclusion(draft)),
      updateExclusionTerms: (id, terms) => run(() => repository.updateExclusionTerms(id, terms)),
      removeExclusion: (id) => run(() => repository.removeCustomExclusion(id)),

      updateSettings: (patch) => run(() => repository.updateSettings(patch)),
    }),
    [ready, error, inventory, staples, exclusions, settings, repository, run],
  );
}
