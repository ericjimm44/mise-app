# Agent D — Cookbook & Progression

**Directory you own:** `src/cookbook/`
**Branch / worktree:** `feat/cookbook` — `/workspace/mise-book`
**Depends on:** the frozen contract only.

This is the retention engine. It's the reason someone opens the app in week six,
when the novelty of recipe generation has worn off and what's left is the
evidence that they've actually got better at cooking.

---

## What you're building

### 1. Dexie persistence — you own the storage layer

Every table in `@contract/db` is yours: reads, writes, migrations, queries.
Other agents go through exports you provide rather than touching Dexie directly.

The schema is frozen; **the queries are yours to design.** Note which properties
are indexed and query on those — an index you don't query is dead weight, and a
query on an unindexed property is a full table scan.

Agent C merges before you and will have written a `src/inventory/storage.ts`
interface for its own tables. The orchestrator reconciles the two at your merge.
Expect that conversation; don't pre-emptively reach into `src/inventory/`.

### 2. Saved recipes are immutable snapshots

**A saved recipe never regenerates.** It never re-validates against a changed
inventory. It never silently updates. The recipe you cooked in March is the
recipe you read in November.

The contract gives you two tools to make that provable rather than merely
promised:

- `deepFreeze()` — freeze on write. A later mutation throws in strict mode
  instead of quietly succeeding.
- `contentHash()` — store it at save time in `SavedRecipe.contentHash`. Drift
  becomes detectable after the fact instead of invisible.

Concretely: **never issue an update against `savedRecipes`.** Post-cook feedback
lives on `CookLog`, a separate table, keyed by `savedRecipeId`. If you find
yourself wanting to write a field back onto a saved recipe, that field belongs
on `CookLog`.

Also snapshot `generatedFrom` — the inventory, ambition, and active exclusions at
generation time. That's the context for why the recipe chose what it chose, and
it's what makes an old recipe legible later.

### 3. Post-cook rating

Would-make-again, actual difficulty, actual active minutes, notes, and which
techniques were actually performed. `CookLog` in the contract is the shape.

Keep it short. This is filled in by someone who has just cooked and eaten and
wants to put their phone down.

### 4. Difficulty calibration

Feed actual-vs-estimated back into `DifficultyCalibration`:

- `starBias` — mean signed error (actual − estimated).
- `activeMinuteRatio` — mean ratio of actual to estimated active minutes.
- `sampleSize` — and **don't apply calibration below a meaningful sample.**
  Adjusting the whole app off one data point is worse than not adjusting at all.

Agent A reads this via `GenerationRequest.calibration`. Export it cleanly.

The point: a cook who consistently finds 3-star recipes easy gets harder
suggestions. The app adjusts to the person, rather than the person adjusting to
the app.

### 5. Technique XP grid — owned vs locked

The visible payoff, and a Definition-of-Done item: *after five cooks, I can see a
grid of which restaurant techniques I now own.*

- All 40 techniques from `@contract/techniques`, grouped by `family`.
- Level 0 = locked. 1 = learned, 2 = practiced, 3 = owned.
- Progression comes from `CookLog.techniquesPerformed`. Decide and document the
  thresholds — something like performed once → learned, three times → practiced,
  six → owned. Encode it in one place, not scattered.
- `semantic.owned` / `ownedWash` exist in the tokens for this.
- Each technique opens its `why_it_works`, its three levels, and its failure
  modes. **Render the `videoUrl` slot even though it's null** — that's the whole
  reason the field exists (`docs/decisions.md` §2). An empty, honest placeholder,
  not stock footage.

### 6. JSON export / import — required, not optional

This came out of Phase 0 (`docs/decisions.md` §3) and is a real requirement, not
a nice-to-have.

Local-first with no sync means a browser "clear site data" can destroy six weeks
of technique progression. Export is the escape hatch that makes "no accounts"
survivable.

- Export: saved recipes, cook logs, technique progress, calibration, settings,
  inventory, exclusions — one JSON file, downloadable.
- Import: validate before writing. Reject a malformed file loudly rather than
  half-importing it.
- Version the export format. Future-you will thank present-you.

---

## Presentation

`@contract/tokens`, light palette. A cookbook, not a dashboard — which matters
most here, because a technique grid is exactly the thing that wants to become a
dashboard full of progress bars and badges. Resist it. Hairlines, whitespace,
one restrained accent.

No gamification language. No streaks, no points, no confetti. The reward is
seeing that you now own pan sauce, stated plainly.

---

## Tests

`src/cookbook/*.test.ts`. `fake-indexeddb` is wired into the test setup.

- A saved recipe is frozen: mutating it throws.
- Saving stores a `contentHash`, and the hash still matches after a round trip
  through Dexie. **This is the immutability proof the audit will look for.**
- Logging a cook does not alter the saved recipe's `contentHash`.
- Calibration maths: known actual-vs-estimated inputs produce the expected
  `starBias` and `activeMinuteRatio`.
- Calibration is not applied below the minimum sample size.
- Technique progression: N logged cooks of a technique produce the expected level.
- Export → wipe → import restores every table exactly.
- A malformed import is rejected without partially writing.

---

## Standing rules

- Import from `src/contract/*`. **Never edit anything in `src/contract/`.** If you believe the contract is wrong, stop and report to the orchestrator.
- Stay inside your assigned directories. Touching another agent's files is a failure.
- No new dependencies without orchestrator approval.
- Write tests for your own module. A feature isn't done until its tests pass.
- Report back with: what you built, what you assumed, what you couldn't do.
