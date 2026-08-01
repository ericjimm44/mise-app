# Agent B — Cook Mode & Timers

**Directory you own:** `src/cookmode/`
**Branch / worktree:** `feat/cookmode` — `/workspace/mise-cook`
**Depends on:** the frozen contract only.

The hardest and most valuable feature in the app. Home cooks don't fail on
instructions — they fail on **coordination**. The sauce breaks while the protein
overcooks. Everything below exists to solve that one problem.

---

## What you're building

A full-screen, inverted, tap-to-advance cooking surface driven by a `Recipe`.

### 1. Concurrent timers

Multiple timers running at once, each labelled with its step, all visible in a
persistent tray. Three at once is the stated bar — the audit will test exactly
that.

**Compute remaining time from wall-clock, never by counting ticks.** The
contract's `ActiveTimer` is shaped for this: `startedAt`, `pausedAccumMs`,
`pausedAt`. A `setInterval` that decrements a counter drifts when the tab is
backgrounded and stalls outright when the OS suspends the timer. Derive:

```ts
const elapsed = Date.now() - timer.startedAt - timer.pausedAccumMs;
```

The interval exists only to re-render. If it fires late, the number is still right.

### 2. Firing while backgrounded

Sound + haptic, via service worker + Web Audio + the Vibration API. Wake Lock
held while Cook Mode is open.

**This is the platform's weak spot, and how you handle failure is the actual
requirement.** iOS Safari has no Vibration API, suspends Web Audio without a
user gesture, and throttles background timers. So:

- Unlock the `AudioContext` on the first user tap and keep the reference.
- Feature-detect everything. `navigator.vibrate` may not exist. `navigator.wakeLock`
  may not exist. Wake Lock is released when the tab hides — re-acquire on
  `visibilitychange`.
- **Degrade visibly, never silently.** If audio can't fire while backgrounded on
  this device, Cook Mode must say so — one honest line, once. A timer that fails
  quietly is worse than one that admits it can't fire, because the user trusted it.
  This is the honesty thesis applied to the platform.
- On regaining visibility, recompute every timer from wall-clock and show what
  fired while away. Do not silently swallow a timer that elapsed in the background.

### 3. Coordination — the actual product

`can_start_next_step_during` drives the prompt: *"While the thighs rest, start
the sauce."* When the current step has it set, surface the next step as
startable **without** advancing away from the current one.

This is the single most valuable field in the schema. Make it visible, not subtle.

### 4. Doneness cue and failure mode on every step

`doneness_cue` is the truth; the timer is a guess. Give the cue equal or greater
visual weight than the countdown. `failure_mode` is always reachable — inline or
one tap, never buried.

The contract gives `cook.cue` its own token colour for exactly this reason.

### 5. "I'm behind"

Pauses everything, then tells the user what can safely hold and what can't.

Base the judgment on data you have, not vibes:

- `timer_type: 'passive'` generally holds — a rest, a braise, a marinade.
- `timer_type: 'active'` generally cannot — an emulsion, a sear, anything
  mid-Maillard.
- The step's `failure_mode` often says outright what happens if you stall.

Say what holds, say what doesn't, and say what to do about the ones that don't.
It's fine for this to be heuristic — it is not fine for it to be silent.

### 6. Input

**Tap-to-advance.** Oversized targets — `spacing.cookTap` (4.5rem) is the floor,
hittable with a knuckle or a wrist. No voice in v1 (`docs/decisions.md` §5).

**Route every advance through a single `advanceStep()` action.** Voice becomes
one more caller later, not a rewrite. Don't scatter advancement logic across
components.

---

## Presentation

Use `@contract/tokens` — the `cook.*` palette, `fontSize.cookBody` /
`cookTitle` / `cookTimer`, `spacing.cookTap`. Cook Mode deliberately breaks the
restraint of the rest of the app: legibility beats taste when a pan is hot.

**Timers are the only thing that animates.** `motion.timerPulse` is the one
permitted transition. Everything else is instant. `prefers-reduced-motion` is
honoured globally in `index.css` — a countdown still updates, it just doesn't pulse.

---

## Tests

`src/cookmode/*.test.ts`. Use fake timers and control `Date.now()`.

- **Three timers run simultaneously** and each reports the correct remaining
  time. This is a Definition-of-Done item; make the test obvious.
- Advancing wall-clock time by N seconds while "backgrounded" (no ticks fire)
  still produces correct remaining time on the next read. This is the test that
  proves you didn't tick-count.
- Pause/resume arithmetic: `pausedAccumMs` accumulates correctly across multiple
  pause cycles.
- A step with `can_start_next_step_during: true` surfaces the next step without
  advancing.
- "I'm behind" pauses every running timer and classifies passive vs active correctly.
- Missing `navigator.vibrate` / `navigator.wakeLock` degrades without throwing.

---

## Standing rules

- Import from `src/contract/*`. **Never edit anything in `src/contract/`.** If you believe the contract is wrong, stop and report to the orchestrator.
- Stay inside your assigned directories. Touching another agent's files is a failure.
- No new dependencies without orchestrator approval.
- Write tests for your own module. A feature isn't done until its tests pass.
- Report back with: what you built, what you assumed, what you couldn't do.
