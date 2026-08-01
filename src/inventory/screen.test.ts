/**
 * Render smoke tests for the inventory screen.
 *
 * Written with `createElement` rather than JSX because the brief fixes test
 * files at `*.test.ts`. The point is coverage of the wiring — first-run
 * onboarding, the confirm step, and a toggle reaching Dexie — not of markup.
 */

import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiseDatabase } from '@contract/db';
import { InventoryScreen } from './InventoryScreen';
import { DexieInventoryRepository } from './storage';

let dbCount = 0;
function freshRepo(): DexieInventoryRepository {
  dbCount += 1;
  return new DexieInventoryRepository(
    new MiseDatabase(`mise-screen-test-${dbCount}-${Date.now()}`),
  );
}

function renderScreen(repository: DexieInventoryRepository) {
  return render(createElement(InventoryScreen, { repository }));
}

async function completeOnboarding(repo: DexieInventoryRepository) {
  await repo.ensureSeeded();
  await repo.updateSettings({ onboardingComplete: true });
}

describe('InventoryScreen', () => {
  it('opens on the one-time staples setup for a new kitchen', async () => {
    const repo = freshRepo();
    renderScreen(repo);

    expect(await screen.findByText("What's always in your cupboard?")).toBeInTheDocument();
    // Conservative seeding is visible in the UI, not just in the table.
    expect(await screen.findByRole('switch', { name: 'Salt always available' })).toBeChecked();
    expect(
      await screen.findByRole('switch', { name: 'Olive oil always available' }),
    ).not.toBeChecked();
  });

  it('marks onboarding complete and does not ask again', async () => {
    const repo = freshRepo();
    const { unmount } = renderScreen(repo);

    fireEvent.click(await screen.findByRole('button', { name: /this is my cupboard/i }));
    expect(await screen.findByText('Your kitchen')).toBeInTheDocument();
    expect((await repo.getSettings()).onboardingComplete).toBe(true);

    unmount();
    renderScreen(repo);
    expect(await screen.findByText('Your kitchen')).toBeInTheDocument();
  });

  it('requires confirmation before anything is stored', async () => {
    const repo = freshRepo();
    await completeOnboarding(repo);
    renderScreen(repo);

    const input = await screen.findByLabelText('Add an ingredient');
    fireEvent.change(input, { target: { value: '6 chicken thighs' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Proposed, staged, and still not stored.
    expect(await screen.findByText('Confirm before adding')).toBeInTheDocument();
    expect(await repo.listInventory()).toHaveLength(0);

    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 item' }));
    await waitFor(async () => {
      expect(await repo.listInventory()).toHaveLength(1);
    });
    const [stored] = await repo.listInventory();
    expect(stored?.name).toBe('chicken thighs');
    expect(stored?.quantity).toBe('6');
  });

  it('warns when a confirmed item is already excluded', async () => {
    const repo = freshRepo();
    await completeOnboarding(repo);
    renderScreen(repo);

    const input = await screen.findByLabelText('Add an ingredient');
    fireEvent.change(input, { target: { value: 'salmon fillet' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText(/Seafood is excluded/)).toBeInTheDocument();
  });

  it('shows seafood pre-checked on the exclusions panel', async () => {
    const repo = freshRepo();
    await completeOnboarding(repo);
    renderScreen(repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Exclusions' }));
    expect(await screen.findByRole('switch', { name: 'Exclude Seafood' })).toBeChecked();
    expect(await screen.findByRole('switch', { name: 'Exclude Dairy' })).not.toBeChecked();
    // The promise is stated as a filter, not a preference.
    expect(screen.getByText(/thrown away and generated again/)).toBeInTheDocument();
  });

  it('persists an exclusion toggle through the repository', async () => {
    const repo = freshRepo();
    await completeOnboarding(repo);
    renderScreen(repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Exclusions' }));
    fireEvent.click(await screen.findByRole('switch', { name: 'Exclude Seafood' }));

    await waitFor(async () => {
      const exclusions = await repo.listExclusions();
      expect(exclusions.find((e) => e.id === 'seafood')?.enabled).toBe(false);
    });
  });

  it('suggests related terms while a custom exclusion is being typed', async () => {
    const repo = freshRepo();
    await completeOnboarding(repo);
    renderScreen(repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Exclusions' }));
    fireEvent.change(await screen.findByLabelText('Exclusion name'), {
      target: { value: 'mushrooms' },
    });

    expect(await screen.findByRole('button', { name: 'porcini' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Exclude' }));

    await waitFor(async () => {
      const custom = (await repo.listExclusions()).find((e) => e.custom);
      expect(custom?.label).toBe('mushrooms');
      expect(custom?.terms).toContain('shiitake');
    });
  });

  it('writes a settings change straight to the singleton', async () => {
    const repo = freshRepo();
    await completeOnboarding(repo);
    renderScreen(repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Increase Servings' }));

    await waitFor(async () => {
      expect((await repo.getSettings()).servings).toBe(3);
    });
  });
});
