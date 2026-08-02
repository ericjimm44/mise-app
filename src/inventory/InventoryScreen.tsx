/**
 * The inventory & settings screen.
 *
 * Four panels behind one header: what's in the kitchen, the one-time staples
 * setup, exclusions, and the rest of settings. On first run the staples setup
 * comes first — it is the only thing here that is genuinely once-only, and doing
 * it before the first generation is what stops the first recipe asking for
 * vinegar the user hasn't got.
 */

import { useState } from 'react';
import { ExclusionList } from './ExclusionList';
import { IngredientEntry } from './IngredientEntry';
import { InventoryList } from './InventoryList';
import { PantryStaples } from './PantryStaples';
import { SettingsPanel } from './SettingsPanel';
import type { InventoryRepository } from './storage';
import { Section, PrimaryButton } from './ui';
import { useInventoryStore } from './useInventoryStore';

type Panel = 'kitchen' | 'staples' | 'exclusions' | 'settings';

const PANELS: readonly { id: Panel; label: string }[] = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'staples', label: 'Staples' },
  { id: 'exclusions', label: 'Exclusions' },
  { id: 'settings', label: 'Settings' },
];

export function InventoryScreen({ repository }: { repository?: InventoryRepository }) {
  const store = useInventoryStore(repository);
  const [panel, setPanel] = useState<Panel>('kitchen');

  if (!store.ready || !store.settings) {
    return (
      <main className="mx-auto max-w-2xl px-gutter py-section">
        <p className="text-small text-ink-faint">Opening your kitchen…</p>
      </main>
    );
  }

  const settings = store.settings;

  // First run: the staples setup, once, before anything else.
  if (!settings.onboardingComplete) {
    return (
      <main className="mx-auto max-w-2xl px-gutter py-section">
        <header className="border-b border-rule pb-6">
          <h1 className="text-display">What's always in your cupboard?</h1>
          <p className="mt-3 max-w-prose text-lead text-ink-soft">
            Switch on only what is genuinely there. Mise treats these as always available and
            will build a recipe around one — so an optimistic list here is how you end up at
            the shop on a Tuesday night.
          </p>
        </header>

        <div className="mt-section">
          <PantryStaples
            staples={store.staples}
            exclusions={store.exclusions}
            onToggle={(id, enabled) => void store.setStapleEnabled(id, enabled)}
            onAdd={(name) => void store.addStaple(name)}
            onRemove={(id) => void store.removeStaple(id)}
          />
        </div>

        <div className="mt-section border-t border-rule pt-6">
          <PrimaryButton onClick={() => void store.updateSettings({ onboardingComplete: true })}>
            Done — this is my cupboard
          </PrimaryButton>
          <p className="mt-3 text-small text-ink-faint">You can change any of this later.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-gutter py-section">
      <header>
        <h1 className="text-display">Your kitchen</h1>
        <p className="mt-2 max-w-prose text-lead text-ink-soft">
          Everything Mise is allowed to cook with, and everything it must never reach for.
        </p>
      </header>

      <nav className="mt-8 flex gap-6 border-b border-rule" aria-label="Inventory sections">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-current={panel === p.id ? 'page' : undefined}
            onClick={() => setPanel(p.id)}
            className={[
              '-mb-px min-h-tap border-b font-sans text-small',
              panel === p.id
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink-soft',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {store.error ? (
        <p className="mt-6 rounded bg-danger-wash px-4 py-3 text-small text-danger">
          {store.error}
        </p>
      ) : null}

      <div className="mt-section">
        {panel === 'kitchen' ? (
          <>
            <Section title="Add what you have">
              <IngredientEntry
                exclusions={store.exclusions}
                onConfirm={(drafts) => store.addItems(drafts)}
              />
            </Section>
            <Section title="In the kitchen">
              <InventoryList
                items={store.inventory}
                onRemove={(id) => void store.removeItem(id)}
                onClear={() => void store.clearInventory()}
              />
            </Section>
          </>
        ) : null}

        {panel === 'staples' ? (
          <Section
            title="Pantry staples"
            intro="Always-available items. The generator may use these without it counting as a shopping trip."
          >
            <PantryStaples
              staples={store.staples}
              exclusions={store.exclusions}
              onToggle={(id, enabled) => void store.setStapleEnabled(id, enabled)}
              onAdd={(name) => void store.addStaple(name)}
              onRemove={(id) => void store.removeStaple(id)}
            />
          </Section>
        ) : null}

        {panel === 'exclusions' ? (
          <Section title="Never cook with">
            <ExclusionList
              exclusions={store.exclusions}
              onToggle={(id, enabled) => void store.setExclusionEnabled(id, enabled)}
              onAdd={(draft) => void store.addExclusion(draft)}
              onRemove={(id) => void store.removeExclusion(id)}
            />
          </Section>
        ) : null}

        {panel === 'settings' ? (
          <Section title="How you cook">
            <SettingsPanel
              settings={settings}
              onChange={(patch) => void store.updateSettings(patch)}
            />
          </Section>
        ) : null}
      </div>
    </main>
  );
}
