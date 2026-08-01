# Mise

**A lesson disguised as dinner.**

Every "what's in my fridge" app generates a recipe and stops there. Mise builds
every recipe on named **techniques**, tracks which ones you've actually
performed, and levels them as you cook. The recipe is disposable; the skill is
permanent.

It never claims a dish is Michelin-starred. It names the specific technique
doing the work — the pan sauce, the dry brine, the slow render — and then
teaches it. That honesty is the point: every competitor overclaims.

---

## Status

**Phase 1 of 7 — the contract is written.** No feature code yet.

The build follows a seven-phase process: Goal Discovery → Spec → Verification →
Planning → Build → Self-Review → Audit. Four feature agents (generation, cook
mode, inventory, cookbook) build against a frozen shared contract that none of
them may edit.

| Phase | State |
|---|---|
| 0 — Goal discovery | ✅ `docs/decisions.md` |
| 1 — Contract | ✅ `src/contract/`, 43 tests passing |
| 2 — Verification | ⏳ |
| 3 — Planning & agent briefs | ⏳ |
| 4 — Build | ⏳ |
| 5 — Self-review | ⏳ |
| 6 — Audit | ⏳ |

## The contract

`src/contract/` is the shared layer every agent imports and **no agent may
edit**. It is small on purpose.

| File | What it is |
|---|---|
| `types.ts` | Every shared type. Difficulty is three separate axes and is never collapsed into one number. |
| `recipe.schema.ts` | Zod shape validation, plus the four truth rules that need the user's actual kitchen to evaluate. |
| `techniques.ts` | 40 techniques: the food science, three levels, real failure modes. `videoUrl` null by design. |
| `tokens.ts` | Design tokens. Tailwind derives its theme from this file, so there is one source of truth for colour. |
| `db.ts` | Dexie schema definitions only — no queries. Plus deep-freeze and content hashing for immutable saved recipes. |

### The four validation rules

Nothing renders until it passes all four. A recipe that fails is **discarded and
regenerated**, never shown with a warning:

1. **No silent shopping trips.** Any ingredient not in your inventory must carry
   a substitute you actually have, or be a declared pantry staple. A substitute
   you also don't have is not a substitute.
2. **Exclusions are absolute.** Checked across every string in the recipe —
   ingredients, substitutions, garnishes, chef notes — not just the ingredient
   list. Seafood is excluded by default, including the derived products that
   trip up every other app: fish sauce, oyster sauce, Worcestershire, dashi,
   bottarga.
3. **Every `technique_id` resolves** against the library.
4. **Time is internally consistent.** `total` may be less than `active + passive`
   — that overlap is the coordination the app teaches — but it can never exceed
   it, or fall below the hands-on time.

A fifth, the honesty rule, is enforced the same way: overclaim language
(including "Michelin") is a validation failure, not a style note. Prompts drift;
validators don't.

## Running it

```sh
npm install
cp .env.example .env.local   # add your Anthropic API key
npm run dev
```

```sh
npm test          # contract tests
npm run typecheck
npm run build     # → dist/
```

## Stack

React + Vite + TypeScript, Tailwind. Dexie/IndexedDB, local-first, no backend.
Anthropic API for generation, with Zod validation on every response — reject and
retry, never render unvalidated JSON.

Design is Japanese minimalist, Muji-adjacent: paper base, charcoal text, one
restrained burnt-orange accent. Whitespace over borders, hairlines over card
shadows. Cook mode inverts to dark with large type, readable across a kitchen
with wet hands. Timers are the only thing that animates.

## Non-goals for v1

No AI-generated dish video. No social feed. No grocery integration. No macro
tracking. No accounts or cloud sync. And no claim, anywhere, that a dish is
literally Michelin-starred.

---

*Not a substitute for a real cooking teacher. Food safety is your own —
temperatures and doneness cues are guidance, not guarantees.*
