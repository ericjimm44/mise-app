import { describe, expect, it, vi } from 'vitest';
import type { Rejection } from '@contract/types';
import type { RecipeModelClient, RecipeModelRequest, RecipeModelResult } from './client';
import {
  MAX_ATTEMPTS_CEILING,
  REFUSAL_DETAIL_PREFIX,
  generateRecipe,
  isAbortRejection,
  isRefusalRejection,
} from './generate';
import {
  baseRequest,
  overclaimCandidate,
  schemaInvalidCandidate,
  seafoodCandidate,
  timeInconsistentCandidate,
  unavailableIngredientCandidate,
  unknownTechniqueCandidate,
  validCandidate,
} from './test-fixtures';

/**
 * A scripted stand-in for the model. NEVER hits the network.
 * Each entry is the result of one attempt, in order.
 */
function scriptedClient(results: readonly RecipeModelResult[]): {
  client: RecipeModelClient;
  prompts: string[];
} {
  const prompts: string[] = [];
  let index = 0;
  const client: RecipeModelClient = {
    async complete(request: RecipeModelRequest): Promise<RecipeModelResult> {
      prompts.push(request.userPrompt);
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      if (result === undefined) throw new Error('scriptedClient: no results configured');
      return result;
    },
  };
  return { client, prompts };
}

function ok(parsedOutput: unknown): RecipeModelResult {
  return { stopReason: 'end_turn', refusal: null, parsedOutput };
}

function reasons(rejections: readonly Rejection[]): string[] {
  return rejections.map((r) => r.reason);
}

describe('generateRecipe', () => {
  it('returns ok on the first attempt with no rejections when the recipe is valid', async () => {
    const { client, prompts } = scriptedClient([ok(validCandidate())]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.rejections).toEqual([]);
    expect(prompts).toHaveLength(1);
    if (result.ok) {
      expect(result.recipe.title).toContain('chicken thighs');
      expect(result.recipe.ambition).toBe('weeknight');
    }
  });

  it('retries a malformed response and feeds the failure detail into the retry prompt', async () => {
    const { client, prompts } = scriptedClient([
      { stopReason: 'end_turn', refusal: null, parsedOutput: null },
      ok(validCandidate()),
    ]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(reasons(result.rejections)).toEqual(['malformed_json']);

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).not.toContain('YOUR PREVIOUS ATTEMPT WAS REJECTED');
    expect(prompts[1]).toContain('YOUR PREVIOUS ATTEMPT WAS REJECTED');
    expect(prompts[1]).toContain('no parseable recipe object');
  });

  it('retries a schema-invalid response and quotes the specific schema failures back', async () => {
    const { client, prompts } = scriptedClient([
      ok(schemaInvalidCandidate()),
      ok(validCandidate()),
    ]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(reasons(result.rejections)).toContain('schema_invalid');

    const retryPrompt = prompts[1] ?? '';
    expect(retryPrompt).toContain('[schema_invalid]');
    for (const rejection of result.rejections) {
      expect(retryPrompt).toContain(rejection.detail);
    }
  });

  it('rejects and regenerates a seafood-containing response with reason exclusion_violation', async () => {
    const { client, prompts } = scriptedClient([ok(seafoodCandidate()), ok(validCandidate())]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(reasons(result.rejections)).toContain('exclusion_violation');

    const violation = result.rejections.find((r) => r.reason === 'exclusion_violation');
    expect(violation?.detail).toContain('Seafood');
    expect(violation?.attempt).toBe(1);
    expect(prompts[1]).toContain('[exclusion_violation]');

    // Never rendered: the returned recipe is the clean one, not the rejected one.
    if (result.ok) {
      const items = result.recipe.ingredients.map((i) => i.item);
      expect(items).not.toContain('fish sauce');
    }
  });

  it('rejects an out-of-inventory ingredient that has no substitute', async () => {
    const { client } = scriptedClient([
      ok(unavailableIngredientCandidate()),
      ok(validCandidate()),
    ]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(reasons(result.rejections)).toContain('unavailable_ingredient_without_substitute');
    const rejection = result.rejections.find(
      (r) => r.reason === 'unavailable_ingredient_without_substitute',
    );
    expect(rejection?.detail).toContain('tarragon');
    expect(rejection?.detail).toContain('shopping trip');
  });

  it('rejects an unknown technique_id', async () => {
    const { client } = scriptedClient([ok(unknownTechniqueCandidate())]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 1 });

    expect(result.ok).toBe(false);
    expect(reasons(result.rejections)).toContain('unknown_technique_id');
  });

  it('rejects an internally inconsistent time budget', async () => {
    const { client } = scriptedClient([ok(timeInconsistentCandidate())]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 1 });

    expect(result.ok).toBe(false);
    expect(reasons(result.rejections)).toContain('time_inconsistent');
  });

  it('rejects overclaim language', async () => {
    const { client } = scriptedClient([ok(overclaimCandidate())]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 1 });

    expect(result.ok).toBe(false);
    expect(reasons(result.rejections)).toContain('overclaim_language');
  });

  it('returns ok:false with every rejection recorded when attempts are exhausted, and never throws', async () => {
    const { client, prompts } = scriptedClient([ok(seafoodCandidate())]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 3 });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(prompts).toHaveLength(3);
    expect(result.rejections.length).toBeGreaterThanOrEqual(3);
    expect(new Set(result.rejections.map((r) => r.attempt))).toEqual(new Set([1, 2, 3]));
    expect(reasons(result.rejections)).toContain('exclusion_violation');
  });

  it('records a rejection instead of throwing when the request itself fails', async () => {
    const client: RecipeModelClient = {
      async complete(): Promise<RecipeModelResult> {
        throw new Error('network is down');
      },
    };

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 2 });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.rejections).toHaveLength(2);
    expect(result.rejections[0]?.detail).toContain('network is down');
  });

  it('handles stop_reason: refusal without throwing, and does not retry it', async () => {
    const onRefusal = vi.fn();
    const { client, prompts } = scriptedClient([
      {
        stopReason: 'refusal',
        refusal: { category: 'general_harms', explanation: 'declined' },
        parsedOutput: null,
      },
    ]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 3, onRefusal });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    // A refusal is terminal — retrying the same prompt will not fix it.
    expect(prompts).toHaveLength(1);
    expect(result.rejections).toHaveLength(1);
    expect(isRefusalRejection(result.rejections[0]!)).toBe(true);
    expect(result.rejections[0]?.detail).toContain(REFUSAL_DETAIL_PREFIX);
    expect(result.rejections[0]?.detail).toContain('general_harms');
    expect(onRefusal).toHaveBeenCalledTimes(1);
  });

  it('survives a refusal that arrives with empty content and no stop_details', async () => {
    const { client } = scriptedClient([
      { stopReason: 'refusal', refusal: null, parsedOutput: null },
    ]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(false);
    expect(isRefusalRejection(result.rejections[0]!)).toBe(true);
    expect(result.rejections[0]?.detail).toContain('unknown');
  });

  it('treats a max_tokens stop as retryable and says so in the retry prompt', async () => {
    const { client, prompts } = scriptedClient([
      { stopReason: 'max_tokens', refusal: null, parsedOutput: null },
      ok(validCandidate()),
    ]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(prompts[1]).toContain('max_tokens');
  });

  it('stops on an aborted signal without throwing', async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, prompts } = scriptedClient([ok(validCandidate())]);

    const result = await generateRecipe(baseRequest(), {
      client,
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    expect(prompts).toHaveLength(0);
    expect(isAbortRejection(result.rejections[0]!)).toBe(true);
  });

  it('passes the abort signal through to the model client', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const client: RecipeModelClient = {
      async complete(request: RecipeModelRequest): Promise<RecipeModelResult> {
        seen = request.signal;
        return ok(validCandidate());
      },
    };

    await generateRecipe(baseRequest(), { client, signal: controller.signal });

    expect(seen).toBe(controller.signal);
  });

  it('clamps maxAttempts so a caller cannot start a runaway spend loop', async () => {
    const { client, prompts } = scriptedClient([ok(seafoodCandidate())]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 500 });

    expect(result.attempts).toBe(MAX_ATTEMPTS_CEILING);
    expect(prompts).toHaveLength(MAX_ATTEMPTS_CEILING);
  });

  it('clamps a maxAttempts below one up to a single attempt', async () => {
    const { client, prompts } = scriptedClient([ok(validCandidate())]);

    const result = await generateRecipe(baseRequest(), { client, maxAttempts: 0 });

    expect(result.ok).toBe(true);
    expect(prompts).toHaveLength(1);
  });

  it('carries rejections through on success so the audit can read them', async () => {
    const { client } = scriptedClient([ok(seafoodCandidate()), ok(validCandidate())]);

    const result = await generateRecipe(baseRequest(), { client });

    expect(result.ok).toBe(true);
    expect(result.rejections.length).toBeGreaterThan(0);
  });
});
