# Mise — Phase 0 Decisions

Recorded 2026-08-01. These are the answers to Goal Discovery. They are binding
inputs to the Phase 1 contract. Changing one of these after the contract is
frozen is a re-plan, not a tweak.

---

## Product thesis (restated, not to be diluted)

Every "what's in my fridge" app generates a recipe and stops there. Mise
generates **a lesson disguised as dinner.**

Every recipe is built on named **techniques**. The user's technique history is
tracked and leveled. The recipe is disposable; the skill is permanent.

We never claim a dish is Michelin-starred. We name the specific technique that
makes it restaurant-grade, then teach it. Honesty is the differentiator — every
competitor overclaims.

---

## The five decisions

### 1. Platform — Web-first PWA

React + Vite + TypeScript + Tailwind, shipped as an installable PWA. Not React
Native.

**Consequences the build must honour:**
- Cook Mode's background timers ride on service worker + Web Audio + Vibration
  API + Wake Lock. iOS Safari is the weak platform here; Agent B must degrade
  **visibly** rather than silently. A timer that fails quietly is worse than one
  that admits it can't fire.
- Deploys as a static folder to GitHub Pages.
- Dexie/IndexedDB is the persistence layer.

### 2. Technique media — Text + illustration, `videoUrl` null

The 40-technique library ships as prose: why it works (food science), three
levels (learned → practiced → owned), common failure modes.

**Consequences:**
- `Technique.videoUrl` exists in the contract and is `null` for all 40 seeds.
  A contract test asserts this.
- Every technique card renders a slot for the clip, so adding video later is
  data entry, not a refactor.
- No stock footage, no YouTube embeds. One real "pan sauce" clip will one day
  serve 400 recipes. Architect for that; don't fake it in the meantime.

### 3. Storage — Local-first only, Dexie/IndexedDB

No accounts, no cloud sync, no backend. Matches the declared v1 non-goal.

**Consequences:**
- The Anthropic API key lives client-side. Acceptable for a personal tool,
  **disqualifying for a public product** — it is the single thing that must
  change first if this ever ships to other people. Recorded here so the decision
  is deliberate rather than discovered later.
- **Added requirement:** Agent D ships JSON export/import for the cookbook and
  technique XP. A browser "clear site data" must not be able to destroy six
  weeks of progression. This is the escape hatch that makes "no sync" survivable.

### 4. Ambition — Personal tool first, product-shaped

Built for one user. No onboarding funnel, no analytics, no monetization, no
multi-user data model.

**Consequences:**
- Nothing personal is hardcoded. Exclusions, pantry staples, spice tolerance and
  time ceilings are **data in Dexie**, not constants in source. Seafood is
  excluded by default via a seeded settings record, not an `if` statement in the
  generator.
- Module seams stay clean and contract-driven, so a future product doesn't
  require unwinding anything.

### 5. Cook mode input — Tap-to-advance, oversized targets

Full-screen, inverted dark, tap zones hittable with a knuckle or a wrist. No
voice recognition in v1.

**Consequences:**
- Web Speech API is Chrome-strong and Safari-weak, needs a network round-trip,
  and misfires under extractor-fan and sizzle noise. A false "next" mid-sear
  ruins the dish — worse than no voice at all.
- Agent B routes step advancement through a single `advanceStep()` action so a
  voice trigger can be added later as one more caller, not a rewrite.

---

## Repository

Mise lives in its own repository, `ericjimm44/mise-app`, rather than as a
subdirectory of the `ericjimm44/ericjimm44` personal site.

**Why the split:** every other project on that site is vanilla HTML/CSS/JS with
no build step. Mise needs Vite, TypeScript, Zod and a `node_modules`, because
shared types and runtime validation across four parallel agents are load-bearing
for the whole contract-driven approach. A build-step project sitting next to
three no-build projects is genuine clutter in both directions.

**What it costs:** GitHub Pages has to be configured once for this repo, and
there is a second deploy to keep alive. Build output goes to `dist/`, and
`vite.config.ts` sets `base: '/mise-app/'` to match the Pages URL.

---

## Explicit non-goals for v1

Held against every agent, without exception:

- ❌ AI-generated video of specific dishes
- ❌ Social feed, sharing, following
- ❌ Grocery ordering or delivery integration
- ❌ Nutrition and macro tracking
- ❌ Accounts and cloud sync
- ❌ Any claim a dish is literally Michelin-starred

---

## Definition of done

- Enter what's actually in the kitchen, get a dish makeable with zero extra
  shopping trips
- No recipe ever contains seafood
- Three timers run at once without losing track
- After five cooks, a grid shows which restaurant techniques are now owned
- The app never says "Michelin" — it names the technique and teaches it
