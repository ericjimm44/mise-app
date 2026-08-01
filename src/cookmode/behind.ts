/**
 * "I'm behind" — the panic button, answered with data instead of sympathy.
 *
 * Everything pauses, then the app says which pans can wait and which cannot,
 * and what to do about the ones that cannot. The judgment is heuristic and this
 * file says so out loud. It is NOT allowed to be silent: a cook who is behind
 * and gets a spinner is a cook whose sauce breaks.
 *
 * Sources of judgment, in order of authority:
 *   1. `timer_type` — 'passive' generally holds (a rest, a braise, a marinade);
 *      'active' generally cannot (an emulsion, a sear, anything mid-Maillard).
 *   2. `failure_mode` — the step frequently states outright what happens if you
 *      stall. A passive step whose failure mode is "it overproofs and collapses"
 *      does not hold, however passive the timer is.
 */

import type { RecipeStep, TimerType } from '@contract/types';

/**
 * Failure modes that describe something going wrong because you STOPPED
 * ATTENDING. These are the emergencies — they are already happening.
 */
const ATTENTION_PATTERNS: readonly RegExp[] = [
  /\bbreak(s|ing)?\b/i,
  /\bsplit(s|ting)?\b/i,
  /\bseiz(e|es|ing)\b/i,
  /\bcurdl(e|es|ing)\b/i,
  /\bscorch(es|ing|ed)?\b/i,
  /\bburn(s|ing|t|ed)?\b/i,
  /\bcatch(es)? (on the pan|and burns?)\b/i,
  /\bstick(s|ing)?\b/i,
  /\bdeflat(e|es|ing)\b/i,
  /\bcollaps(e|es|ing)\b/i,
  /\bweep(s|ing)?\b/i,
  /\bsmok(e|es|ing)\b/i,
];

/**
 * Failure modes that describe something going wrong because it KEPT GOING
 * without you. A passive timer that overshoots is still a timer you cannot
 * leave — "it's only resting" is not true of a proof or a brine.
 */
const OVERSHOOT_PATTERNS: readonly RegExp[] = [
  /\bover[-\s]?cook(s|ed|ing)?\b/i,
  /\bover[-\s]?proof(s|ed|ing)?\b/i,
  /\bover[-\s]?prov(e|es|ed|ing)\b/i,
  /\bover[-\s]?reduc(e|es|ed|ing)\b/i,
  /\bover[-\s]?brine(s|d)?\b/i,
  /\bover[-\s]?marinat(e|es|ed|ing)\b/i,
  /\bover[-\s]?extract(s|ed|ing)?\b/i,
  /\bdr(y|ies|ying) out\b/i,
  /\btough(en|ens|ening)?\b/i,
  /\brubbery\b/i,
  /\bmushy\b/i,
  /\bbitter\b/i,
  /\bgrainy\b/i,
];

function firstMatch(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export type HoldRisk = 'holds' | 'overshoots' | 'needs_attention';

export interface HoldVerdict {
  stepId: string;
  /** Tray label if there's a timer, step title otherwise. */
  label: string;
  timerId: string | null;
  timerType: TimerType | null;
  holds: boolean;
  risk: HoldRisk;
  /** Why we decided this — names the evidence, never "because". */
  reason: string;
  /** What to actually do. For things that hold, this is still an instruction. */
  advice: string;
  /** The step's own words, surfaced verbatim so the cook can overrule us. */
  failureMode: string;
}

export interface BehindReport {
  at: number;
  entries: readonly HoldVerdict[];
  /** Timer ids this report paused, so resuming touches only those. */
  pausedByBehind: readonly string[];
  summary: string;
  /** Stated plainly: this is a judgment call, not a measurement. */
  caveat: string;
}

export const BEHIND_CAVEAT =
  'This is a judgment from the timer type and the step’s own failure mode, not a measurement. The doneness cue still outranks it.';

export interface HoldInput {
  step: RecipeStep;
  timerId: string | null;
  /** Falls back to the step's declared `timer_type` when no timer is running. */
  timerType: TimerType | null;
  label: string;
}

export function classifyHold(input: HoldInput): HoldVerdict {
  const { step, timerId, label } = input;
  const timerType = input.timerType ?? step.timer_type;
  const failureMode = step.failure_mode;

  const attention = firstMatch(failureMode, ATTENTION_PATTERNS);
  const overshoot = firstMatch(failureMode, OVERSHOOT_PATTERNS);

  const base = { stepId: step.id, label, timerId, timerType, failureMode };

  if (timerType === 'active' || attention) {
    return {
      ...base,
      holds: false,
      risk: 'needs_attention',
      reason:
        timerType === 'active'
          ? 'Active step — it needs your hands, and it is going wrong while it waits.'
          : 'The failure mode for this step describes something that happens while you are not looking.',
      advice:
        'Deal with this one first. Get it off the heat, or finish it now — do not leave it where it is.',
    };
  }

  if (overshoot) {
    return {
      ...base,
      holds: false,
      risk: 'overshoots',
      reason:
        'Passive, but it keeps going without you — the failure mode is overshooting, not neglect.',
      advice:
        'Stop its clock: pull it off the heat, out of the oven, or into the fridge. The cue is the deadline, not the timer.',
    };
  }

  return {
    ...base,
    holds: true,
    risk: 'holds',
    reason:
      timerType === 'passive'
        ? 'Passive step — waiting is what it is doing anyway.'
        : 'No active timer on this step, and nothing in its failure mode says it degrades while it sits.',
    advice: 'Leave it. Come back to it once the urgent pans are safe.',
  };
}

export function buildBehindReport(
  inputs: readonly HoldInput[],
  pausedByBehind: readonly string[],
  at: number,
): BehindReport {
  const entries = inputs.map(classifyHold);
  return {
    at,
    entries,
    pausedByBehind,
    summary: summarise(entries),
    caveat: BEHIND_CAVEAT,
  };
}

export function holding(report: BehindReport): readonly HoldVerdict[] {
  return report.entries.filter((entry) => entry.holds);
}

export function notHolding(report: BehindReport): readonly HoldVerdict[] {
  return report.entries.filter((entry) => !entry.holds);
}

function summarise(entries: readonly HoldVerdict[]): string {
  if (entries.length === 0) {
    return 'Nothing is running. Everything is paused — take the minute.';
  }
  const urgent = entries.filter((entry) => !entry.holds);
  const safe = entries.filter((entry) => entry.holds);

  if (urgent.length === 0) {
    return `All ${safe.length} paused, and all ${safe.length === 1 ? 'of it holds' : 'of them hold'}. Take the minute.`;
  }
  const urgentNames = urgent.map((entry) => entry.label).join(', ');
  const safePart =
    safe.length === 0
      ? 'Nothing here can safely wait.'
      : `${safe.length} can wait: ${safe.map((entry) => entry.label).join(', ')}.`;
  return `${urgent.length} cannot wait — ${urgentNames}. ${safePart}`;
}
