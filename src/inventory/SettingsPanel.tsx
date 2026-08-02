/**
 * Servings, spice tolerance, and the weeknight active-minute ceiling.
 *
 * All three are rows in Dexie, never constants in source. The ceiling is a hard
 * limit on hands-on minutes for `weeknight` ambition — passive time doesn't
 * count against it, because a four-hour braise is easier than a forty-minute
 * stir-fry, not harder.
 */

import type { UserSettings } from '@contract/types';
import { SETTINGS_BOUNDS, SPICE_TOLERANCE_OPTIONS } from './defaults';
import type { SettingsPatch } from './storage';

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  return (
    <div className="divide-y divide-rule border-t border-rule">
      <Row
        title="Servings"
        hint="How many people a generated recipe should feed."
        control={
          <Stepper
            value={settings.servings}
            min={SETTINGS_BOUNDS.servings.min}
            max={SETTINGS_BOUNDS.servings.max}
            step={1}
            unit={settings.servings === 1 ? 'person' : 'people'}
            label="Servings"
            onChange={(servings) => onChange({ servings })}
          />
        }
      />

      <Row
        title="Spice tolerance"
        hint="How much chilli heat a recipe may carry."
        control={
          <div className="flex flex-wrap gap-2">
            {SPICE_TOLERANCE_OPTIONS.map((option) => {
              const selected = settings.spiceTolerance === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  title={option.hint}
                  onClick={() => onChange({ spiceTolerance: option.value })}
                  className={[
                    'min-h-tap rounded border px-4 font-sans text-small',
                    selected
                      ? 'border-accent bg-accent-wash text-ink'
                      : 'border-rule text-ink-muted hover:border-rule-strong',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        }
      />

      <Row
        title="Weeknight ceiling"
        hint="Hands-on minutes a weeknight recipe may never exceed. Waiting, resting and braising don't count against it."
        control={
          <Stepper
            value={settings.weeknightActiveMinuteCeiling}
            min={SETTINGS_BOUNDS.weeknightActiveMinuteCeiling.min}
            max={SETTINGS_BOUNDS.weeknightActiveMinuteCeiling.max}
            step={5}
            unit="min active"
            label="Weeknight active-minute ceiling"
            onChange={(value) => onChange({ weeknightActiveMinuteCeiling: value })}
          />
        }
      />
    </div>
  );
}

function Row({
  title,
  hint,
  control,
}: {
  title: string;
  hint: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 py-6">
      <div className="max-w-sm">
        <p className="text-lead text-ink">{title}</p>
        <p className="mt-1 text-small text-ink-muted">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  unit,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className="h-tap w-tap rounded-full border border-rule text-body text-ink-soft disabled:text-ink-faint"
      >
        −
      </button>
      <span className="min-w-[7rem] text-center">
        <span className="tnum font-mono text-title text-ink">{value}</span>
        <span className="ml-2 text-small text-ink-muted">{unit}</span>
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className="h-tap w-tap rounded-full border border-rule text-body text-ink-soft disabled:text-ink-faint"
      >
        +
      </button>
    </div>
  );
}
