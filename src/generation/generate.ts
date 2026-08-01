/**
 * The rejection loop.
 *
 * This is the part that matters most. Nothing downstream re-checks anything —
 * the cookbook, cook mode and the XP grid all trust that a recipe which reaches
 * them has already passed `parseAndValidate()`. So:
 *
 *   - Every candidate goes through `parseAndValidate()`. Structured outputs
 *     guarantee SHAPE; they cannot know this cook's inventory or exclusions.
 *   - A candidate that fails is DISCARDED and REGENERATED, with the specific
 *     failure details fed back into the retry prompt. There is no
 *     "render it with a warning" path. That shrug is the product's death.
 *   - Every rejection is accumulated and returned, including on success. The
 *     audit and the tests both read them.
 *   - Attempts are capped. This never throws on a generation failure.
 */

import { parseAndValidate } from '@contract/recipe.schema';
import type { ValidationFailure } from '@contract/recipe.schema';
import type { GenerationRequest, GenerationResult, Rejection } from '@contract/types';
import type { RecipeModelClient, RefusalInfo } from './client';
import { createRecipeModelClient } from './client';
import { DEFAULT_MAX_ATTEMPTS } from './config';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

/**
 * Hard ceiling on attempts regardless of what the caller asks for. A runaway
 * regeneration loop with a client-side API key spends real money.
 */
export const MAX_ATTEMPTS_CEILING = 5;

/**
 * A refusal is NOT a retryable malformed response, and the frozen
 * `RejectionReason` union has no `refusal` member. It is recorded under
 * `malformed_json` (the response contained no usable recipe) but tagged with
 * this prefix so callers, tests and the audit can tell the two apart, and it is
 * additionally surfaced through `opts.onRefusal`.
 *
 * See the report to the orchestrator: `RejectionReason` arguably wants a
 * `model_refusal` member. Working around it here rather than editing the
 * contract.
 */
export const REFUSAL_DETAIL_PREFIX = 'model_refusal:';

/** Tag for a run stopped by the caller's `AbortSignal`. */
export const ABORTED_DETAIL_PREFIX = 'aborted:';

export function isRefusalRejection(rejection: Rejection): boolean {
  return rejection.detail.startsWith(REFUSAL_DETAIL_PREFIX);
}

export function isAbortRejection(rejection: Rejection): boolean {
  return rejection.detail.startsWith(ABORTED_DETAIL_PREFIX);
}

export interface GenerateOptions {
  /** Attempts before giving up. Default 3, clamped to [1, MAX_ATTEMPTS_CEILING]. */
  maxAttempts?: number;
  signal?: AbortSignal;
  /**
   * Injection seam. Defaults to a real browser-side Anthropic client; tests and
   * any future server-side proxy pass their own.
   */
  client?: RecipeModelClient;
  /**
   * Called when the model refuses. A refusal is surfaced distinctly because it
   * is not a bad recipe — it is the model declining, and retrying the same
   * prompt will not fix it.
   */
  onRefusal?: (refusal: RefusalInfo, attempt: number) => void;
}

function clampAttempts(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return DEFAULT_MAX_ATTEMPTS;
  const floored = Math.floor(requested);
  if (floored < 1) return 1;
  if (floored > MAX_ATTEMPTS_CEILING) return MAX_ATTEMPTS_CEILING;
  return floored;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export async function generateRecipe(
  req: GenerationRequest,
  opts: GenerateOptions = {},
): Promise<GenerationResult> {
  const maxAttempts = clampAttempts(opts.maxAttempts);
  const client = opts.client ?? createRecipeModelClient();
  const system = buildSystemPrompt();

  const ctx = {
    inventory: req.inventory,
    pantryStaples: req.pantryStaples,
    exclusions: req.exclusions,
  };

  const rejections: Rejection[] = [];
  let previousFailures: readonly ValidationFailure[] = [];
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;

    if (opts.signal?.aborted === true) {
      rejections.push({
        reason: 'malformed_json',
        detail: `${ABORTED_DETAIL_PREFIX} generation was aborted before attempt ${attempt}`,
        attempt,
      });
      return { ok: false, rejections, attempts: attempt - 1 };
    }

    const userPrompt = buildUserPrompt(req, { previousFailures });

    let parsedOutput: unknown;
    try {
      const result = await client.complete({
        system,
        userPrompt,
        ...(opts.signal ? { signal: opts.signal } : {}),
      });

      // `stop_reason` is checked before content is read. A refusal is an HTTP
      // 200 with empty or partial content; it is terminal, not retryable.
      if (result.refusal !== null || result.stopReason === 'refusal') {
        const refusal: RefusalInfo = result.refusal ?? { category: null, explanation: null };
        opts.onRefusal?.(refusal, attempt);
        rejections.push({
          reason: 'malformed_json',
          detail:
            `${REFUSAL_DETAIL_PREFIX} the model declined this request ` +
            `(category: ${refusal.category ?? 'unknown'}` +
            `${refusal.explanation ? `, explanation: ${refusal.explanation}` : ''}). ` +
            'Not retried — a refusal is not a malformed response.',
          attempt,
        });
        return { ok: false, rejections, attempts: attempt };
      }

      if (result.stopReason === 'max_tokens') {
        previousFailures = [
          {
            reason: 'malformed_json',
            detail:
              'Response stopped at max_tokens, so the recipe was truncated. ' +
              'If this recurs, raise max_tokens and stream — do not trim the schema.',
          },
        ];
        rejections.push({ ...previousFailures[0]!, attempt });
        continue;
      }

      // Structured outputs make this a near-dead path, but `parsed_output` can
      // still be null: a partial response, or content the parser choked on.
      if (result.parsedOutput === null || result.parsedOutput === undefined) {
        previousFailures = [
          {
            reason: 'malformed_json',
            detail:
              'Your previous response contained no parseable recipe object ' +
              `(stop_reason: ${result.stopReason ?? 'null'}). Return a single ` +
              'recipe object matching the schema, and nothing else.',
          },
        ];
        rejections.push({ ...previousFailures[0]!, attempt });
        continue;
      }

      parsedOutput = result.parsedOutput;
    } catch (error) {
      if (isAbortError(error) || opts.signal?.aborted === true) {
        rejections.push({
          reason: 'malformed_json',
          detail: `${ABORTED_DETAIL_PREFIX} ${errorMessage(error)}`,
          attempt,
        });
        return { ok: false, rejections, attempts: attempt };
      }
      previousFailures = [
        {
          reason: 'malformed_json',
          detail: `Request or parse failed: ${errorMessage(error)}`,
        },
      ];
      rejections.push({ ...previousFailures[0]!, attempt });
      continue;
    }

    // Layer 1 (shape) + Layer 2 (truth). Both must pass. This is the only
    // sanctioned path from model output to a rendered recipe.
    const outcome = parseAndValidate(parsedOutput, ctx);

    if (outcome.ok) {
      return { ok: true, recipe: outcome.recipe, attempts: attempt, rejections };
    }

    previousFailures = outcome.failures;
    for (const failure of outcome.failures) {
      rejections.push({ reason: failure.reason, detail: failure.detail, attempt });
    }
  }

  return { ok: false, rejections, attempts: attempt };
}
