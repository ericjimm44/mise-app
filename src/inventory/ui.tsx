/**
 * Small presentation primitives shared across the inventory screens.
 *
 * Every colour here is a Tailwind utility generated from `@contract/tokens`.
 * There is no hex code anywhere in `src/inventory/` — if it isn't in the
 * contract, it isn't a colour we use.
 *
 * Whitespace separates content. Hairlines do the little that's left. No cards,
 * no shadows, no gradients.
 */

import type { ReactNode } from 'react';

export function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-section first:mt-0">
      <h2 className="text-title">{title}</h2>
      {intro ? <p className="mt-2 max-w-prose text-small text-ink-muted">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Hairline() {
  return <hr className="border-0 border-t border-rule" />;
}

/** Uppercase micro label for grouping. Type does the work a border would. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-6 font-sans text-micro uppercase tracking-wide text-ink-faint">{children}</h3>
  );
}

/**
 * Switch. Reads as a state, not a checkbox — exclusions and staples are things
 * that are on or off, and the difference matters enough to look deliberate.
 */
export function Toggle({
  checked,
  onChange,
  label,
  tone = 'accent',
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  tone?: 'accent' | 'danger';
  disabled?: boolean;
}) {
  const on = tone === 'danger' ? 'bg-danger' : 'bg-accent';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-6 w-11 shrink-0 rounded-full border border-rule-strong',
        'disabled:opacity-40',
        checked ? on : 'bg-paper-sunken',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full bg-paper-raised',
          checked ? 'left-[1.5rem]' : 'left-[0.15rem]',
        ].join(' ')}
      />
    </button>
  );
}

export function RowButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="min-h-tap px-2 font-sans text-small text-ink-faint hover:text-ink-soft"
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  onClick,
  children,
  disabled = false,
  type = 'button',
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-h-tap rounded bg-accent px-5 font-sans text-small text-paper-raised hover:bg-accent-deep disabled:bg-paper-sunken disabled:text-ink-faint"
    >
      {children}
    </button>
  );
}

export function QuietButton({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-tap rounded border border-rule px-4 font-sans text-small text-ink-soft hover:border-rule-strong disabled:text-ink-faint"
    >
      {children}
    </button>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  label,
  onKeyDown,
  inputRef,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      aria-label={label}
      value={value}
      placeholder={placeholder ?? ''}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      {...(onKeyDown ? { onKeyDown } : {})}
      className="min-h-tap w-full rounded border-0 border-b border-rule-strong bg-paper-sunken px-3 font-sans text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
    />
  );
}

/** Empty state. A sentence, not an illustration. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-small text-ink-faint">{children}</p>;
}
