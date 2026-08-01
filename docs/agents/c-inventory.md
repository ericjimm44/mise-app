# Agent C — Inventory & Settings

**Directory you own:** `src/inventory/`
**Branch / worktree:** `feat/inventory` — `/workspace/mise-inv`
**Depends on:** the frozen contract only.

You merge first. Everything downstream reads what you write, so your Dexie
records being right matters more than your UI being pretty.

---

## What you're building

### 1. Manual ingredient entry, search-as-you-type

The primary input. It must be fast enough to enter a fridge's worth of food
without friction.

**Architect the input so photo capture drops in later without a refactor.** The
way to do that is to put a boundary between *"something produced a list of
candidate ingredient names"* and *"the app confirms and stores them."* Photo
capture is then one more producer behind that boundary, not a rewrite. Something
like:

```ts
interface IngredientSource {
  id: 'manual' | 'photo';
  // returns candidates for the user to confirm before anything is stored
}
```

Confirmation is not optional even for manual entry — it's the seam that makes
photo capture cheap later.

`InventoryItem.normalized` is **derived, never user-typed** — the contract says
so. Use `normalize()` from `@contract/recipe.schema` so your normalisation and
the validator's are the same function. If they drift, Rule 1 starts rejecting
recipes for ingredients the user actually has.

### 2. Pantry staples, one-time setup

Always-available items the generator may use without counting as a shopping
trip. Seed a sensible default set (salt, pepper, oil, common vinegars, basic
dried spices) with each one toggleable.

Be conservative about what ships enabled. A staple wrongly assumed present is a
Rule 1 violation that the validator can't catch — it looks available, so it
passes, and then the user opens a cupboard and it isn't there.

### 3. Exclusion list UI

**Seafood pre-checked.** `DEFAULT_EXCLUSIONS` in `@contract/recipe.schema`
already ships it enabled, along with pork, dairy, gluten, egg, peanut, tree nut,
and shellfish-only as seeded-but-disabled.

- Seed those into Dexie on first run. Read from the table thereafter — the
  contract constant is the seed, not the runtime source of truth.
- Custom exclusions: users add their own, with `custom: true`.
- **Show the user that an exclusion is a filter, not a preference.** The
  distinction is the product's promise, and the UI should make it feel absolute.
- When a user adds a custom exclusion, prompt for related terms. "No mushrooms"
  should probably also catch porcini, shiitake, and truffle. You won't get this
  perfect; getting it partly right beats a single literal string.

### 4. The rest of settings

Spice tolerance, servings, weeknight active-minute ceiling. `UserSettings` in
the contract is the shape — a singleton row keyed `'singleton'`.

**Nothing personal is hardcoded** (`docs/decisions.md` §4). Every one of these is
data in Dexie, never a constant in source. Seafood's default comes from a seeded
settings record, not an `if` statement.

---

## Storage boundary — read this twice

**Agent D owns all Dexie reads and writes.** You own inventory *UI and logic*;
D owns persistence.

The tables are already declared in `@contract/db` — `inventory`, `pantryStaples`,
`exclusions`, `settings`. In merge order you land **before** D, so D's repository
layer won't exist yet. So:

1. Define the repository interface you need, in your own directory —
   `src/inventory/storage.ts` — as an interface plus a thin Dexie implementation.
2. Keep every Dexie call behind that interface. No `db.inventory.put()` scattered
   through components.
3. When D merges, the orchestrator reconciles the two. If your calls are behind
   one interface, that's a small change. If they're spread across ten components,
   it isn't.

Do not write to `savedRecipes`, `cookLogs`, `techniqueProgress`, or `calibration`.
Those are D's.

---

## Presentation

`@contract/tokens`, light palette. Japanese minimalist, Muji-adjacent — a
cookbook, not a dashboard. Whitespace over borders, hairline rules over card
shadows, no gradients, no drop shadows. `bg-paper`, `text-ink`, `border-rule`
are generated from the contract; don't reach for a hex code.

Serif for headings (it's already the `h1`–`h3` default), clean sans for chrome.

---

## Tests

`src/inventory/*.test.ts`. `fake-indexeddb` is wired into the test setup, so you
can exercise real Dexie against your own `new MiseDatabase(uniqueName)`.

- Adding an item stores a correctly normalised `normalized` field.
- The normalisation matches `normalize()` from the contract — assert against it
  directly, so drift fails the build.
- Seafood is enabled by default after first-run seeding.
- Toggling an exclusion persists and reads back.
- A custom exclusion round-trips with `custom: true`.
- Settings are a genuine singleton — writing twice updates rather than duplicates.

---

## Standing rules

- Import from `src/contract/*`. **Never edit anything in `src/contract/`.** If you believe the contract is wrong, stop and report to the orchestrator.
- Stay inside your assigned directories. Touching another agent's files is a failure.
- No new dependencies without orchestrator approval.
- Write tests for your own module. A feature isn't done until its tests pass.
- Report back with: what you built, what you assumed, what you couldn't do.
