# Agent A — Generation Core

**Directory you own:** `src/generation/`
**Branch / worktree:** `feat/generation` — `/workspace/mise-gen`
**Depends on:** the frozen contract only. No other agent.

You are the highest-risk piece of this build. You get the most scrutiny at review,
because everything downstream trusts that what you emit has already been checked.

---

## What you're building

Pure logic. **Zero UI.** Not one `.tsx` file, not one Tailwind class. If a
component would be useful, that's Agent C or D's problem — you export a function
and a type.

1. **Prompt construction** from a `GenerationRequest` (see `@contract/types`).
2. **The Anthropic API call**, using structured outputs (details below).
3. **Validation** via `parseAndValidate()` from `@contract/recipe.schema`.
4. **The rejection/retry loop** — discard and regenerate on any failure, feeding
   the specific failures back into the retry prompt.
5. **The three ambition tiers** — Weeknight / Elevated / Project.
6. **Exclusion enforcement**, which is mostly the contract's job; yours is to
   make the model unlikely to violate it in the first place.

Export surface, roughly:

```ts
export async function generateRecipe(
  req: GenerationRequest,
  opts?: { maxAttempts?: number; signal?: AbortSignal },
): Promise<GenerationResult>;
```

`GenerationResult` is already defined in the contract. Return it exactly.

---

## Use structured outputs. Do not hand-parse JSON.

The build brief says "the model must return strict JSON, no prose, no markdown
fences." That was written before we pinned the SDK. **The API can now enforce
that at the schema level, so do not ask for it in prose and then parse
defensively.** Verified present in the installed SDK (`@anthropic-ai/sdk` 0.115.0):

```ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { RecipeSchema } from '@contract/recipe.schema';

const response = await client.messages.parse({
  model: 'claude-opus-5',
  max_tokens: 16000,
  output_config: { format: zodOutputFormat(RecipeSchema) },
  messages: [{ role: 'user', content: prompt }],
});

const candidate = response.parsed_output; // may be null — guard it
```

This makes `malformed_json` a near-dead rejection path rather than the common
case. **Keep the `malformed_json` branch anyway** — `parsed_output` can be null,
and a refusal or a `max_tokens` stop can still produce something unusable.

**Still run `parseAndValidate()` on the result.** Structured outputs guarantee
*shape*; they cannot know the user's inventory or exclusion list. Layer 2 —
the four rules — is the whole point and is not optional.

### Model and parameters — verified, do not substitute

| Setting | Value | Why |
|---|---|---|
| `model` | `'claude-opus-5'` | Exact ID. No date suffix. |
| `max_tokens` | 16000 non-streaming | Below the SDK HTTP timeout threshold. Stream if you go higher. |
| `thinking` | **omit it** | On Claude Opus 5 thinking is on by default; omitting runs adaptive. |
| `temperature` / `top_p` / `top_k` | **never set them** | Removed on this model — any value returns a 400. |
| assistant prefill | **never** | Last-assistant-turn prefills return a 400. Structured outputs replace them. |

`max_tokens` caps thinking *plus* response text together. A long Project-tier
recipe with adaptive thinking can run close to the ceiling — if you see
`stop_reason: 'max_tokens'`, raise it and stream rather than trimming the schema.

**Check `stop_reason` before reading content.** Claude Opus 5 can return
`stop_reason: 'refusal'` on a successful HTTP 200 with empty or partial content.
Indexing `content[0]` unconditionally will throw. A refusal is not a retryable
malformed response — surface it distinctly.

### Browser API key

Local-first, no backend, so the call happens client-side. Construct with
`dangerouslyAllowBrowser: true` and read the key from
`import.meta.env.VITE_ANTHROPIC_API_KEY`.

This is a deliberate, recorded trade-off for a personal tool
(`docs/decisions.md` §3) and is **disqualifying for a public product**. Put a
comment saying exactly that at the construction site, so whoever ships this
publicly one day finds the warning before the incident.

---

## The rejection loop

This is the part that matters most.

- Default 3 attempts. Cap it — an infinite regeneration loop with a client-side
  key is a way to spend real money on a broken prompt.
- On failure, **feed the specific `ValidationFailure.detail` strings back into
  the retry prompt.** "That recipe was rejected because: `shallot` is not in
  inventory and has no substitute" produces a fixable second attempt. "Try
  again" produces the same recipe.
- Accumulate every `Rejection` and return them all in `GenerationResult`,
  including on success. The audit and the tests both read them.
- Never render a rejected recipe. There is no "show it with a warning" path.
  That shrug is the product's death.

---

## Prompt construction

The prompt is a real deliverable, not glue. It should:

- List the user's inventory and pantry staples explicitly, and state that
  anything outside those lists needs a substitute drawn from inside them.
- State exclusions as absolute, and name the derived products —
  "no seafood" is not enough; the model must know that means no fish sauce,
  no oyster sauce, no Worcestershire, no dashi, no bottarga.
- Encode the star rubric explicitly (it's in the contract's `Difficulty` docs).
  Don't let the model freelance difficulty.
- Encode the ambition tier as a real constraint, not a vibe:
  - **Weeknight** — respects `weeknightActiveMinuteCeiling`, one or two techniques,
    ≤ 3 stars.
  - **Elevated** — a technique the user hasn't owned yet, 3–4 stars.
  - **Project** — multi-component or multi-day, 4–5 stars, passive time is fine.
- Pitch technique level at the user: pass `techniqueProgress` in, and tell the
  model to build on what they own and introduce at most one new technique.
- **Forbid overclaim language.** The validator catches it, but a rejection costs
  a round trip. Tell the model to name the technique doing the work instead.

Consider a prompt-caching breakpoint on the stable prefix (rubric, technique
library, format rules) with the volatile part — inventory, exclusions — after it.
See `shared/prompt-caching.md` if you want it; it's a nice-to-have, not a
requirement. Note the cache minimum on Claude Opus 5 is 512 tokens.

---

## Tests

`src/generation/*.test.ts`. Mock the API — **do not hit the real endpoint in
tests.** Cover at minimum:

- A malformed response triggers a retry, and the retry prompt contains the
  failure detail.
- A seafood-containing response is rejected and regenerated, and the rejection
  reason is `exclusion_violation`.
- An out-of-inventory ingredient with no substitute is rejected.
- Exhausting `maxAttempts` returns `{ ok: false }` with every rejection recorded,
  and never throws.
- `stop_reason: 'refusal'` is handled without throwing.
- A valid response returns `{ ok: true }` on the first attempt with no rejections.

---

## Standing rules

- Import from `src/contract/*`. **Never edit anything in `src/contract/`.** If you believe the contract is wrong, stop and report to the orchestrator.
- Stay inside your assigned directories. Touching another agent's files is a failure.
- No new dependencies without orchestrator approval.
- Write tests for your own module. A feature isn't done until its tests pass.
- Report back with: what you built, what you assumed, what you couldn't do.
