/**
 * The Anthropic call. Everything model-specific lives here so the rejection
 * loop in `generate.ts` stays testable without a network stub.
 */

import Anthropic from '@anthropic-ai/sdk';
import { MAX_TOKENS, MODEL } from './config';
import { recipeOutputFormat } from './output-format';

/** A system prompt block. `cache_control` marks the end of the stable prefix. */
export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface RecipeModelRequest {
  system: readonly SystemBlock[];
  userPrompt: string;
  signal?: AbortSignal;
}

export interface RefusalInfo {
  category: string | null;
  explanation: string | null;
}

export interface RecipeModelResult {
  stopReason: string | null;
  /** Non-null only when `stop_reason === 'refusal'`. */
  refusal: RefusalInfo | null;
  /** `null` when the model produced nothing parseable. */
  parsedOutput: unknown;
}

/** The seam the generator talks to. Tests implement this directly. */
export interface RecipeModelClient {
  complete(request: RecipeModelRequest): Promise<RecipeModelResult>;
}

/**
 * The slice of the Anthropic SDK we use. Declared structurally so tests can
 * substitute a fake without constructing a real client.
 */
export interface AnthropicLike {
  messages: {
    parse(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<{
      stop_reason?: string | null;
      stop_details?: { category?: string | null; explanation?: string | null } | null;
      content?: unknown;
      parsed_output?: unknown;
    }>;
  };
}

interface ImportMetaEnvLike {
  VITE_ANTHROPIC_API_KEY?: string;
}

function readApiKeyFromEnv(): string | undefined {
  const meta = import.meta as unknown as { env?: ImportMetaEnvLike };
  return meta.env?.VITE_ANTHROPIC_API_KEY;
}

/**
 * Construct the browser-side Anthropic client.
 *
 * `dangerouslyAllowBrowser: true` means the API key ships to the browser and is
 * readable by anyone with devtools. That is an accepted trade-off *for a
 * personal, local-first tool with no backend* — see `docs/decisions.md` §3,
 * where it is recorded deliberately rather than discovered later.
 *
 * It is DISQUALIFYING FOR A PUBLIC PRODUCT. If Mise is ever shipped to other
 * people, this is the single thing that must change first: the key moves behind
 * a server that proxies generation, and this flag goes away. Shipping this as-is
 * to real users means handing every visitor a live billing credential.
 */
export function createAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey ?? readApiKeyFromEnv();
  return new Anthropic({
    apiKey: key ?? '',
    dangerouslyAllowBrowser: true,
  });
}

export interface RecipeModelClientOptions {
  /** Inject a client (tests, or a future server-side proxy). */
  anthropic?: AnthropicLike;
  apiKey?: string;
}

export function createRecipeModelClient(
  options: RecipeModelClientOptions = {},
): RecipeModelClient {
  const anthropic: AnthropicLike =
    options.anthropic ?? (createAnthropicClient(options.apiKey) as unknown as AnthropicLike);

  return {
    async complete(request: RecipeModelRequest): Promise<RecipeModelResult> {
      // NOTE ON PARAMETERS — every omission below is load-bearing:
      //   no `temperature` / `top_p` / `top_k` — removed on this model, 400 on any value
      //   no `thinking`                        — adaptive is on by default; omit it
      //   no assistant prefill                 — 400; structured outputs replace it
      const params: Record<string, unknown> = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: request.system,
        output_config: { format: recipeOutputFormat() },
        messages: [{ role: 'user', content: request.userPrompt }],
      };

      const response = await anthropic.messages.parse(
        params,
        request.signal ? { signal: request.signal } : undefined,
      );

      const stopReason = response.stop_reason ?? null;

      // Check `stop_reason` BEFORE touching content. Claude Opus 5 can return
      // `stop_reason: 'refusal'` on a successful HTTP 200 with empty or partial
      // content; indexing `content[0]` unconditionally throws.
      if (stopReason === 'refusal') {
        return {
          stopReason,
          refusal: {
            category: response.stop_details?.category ?? null,
            explanation: response.stop_details?.explanation ?? null,
          },
          parsedOutput: null,
        };
      }

      return {
        stopReason,
        refusal: null,
        parsedOutput: response.parsed_output ?? null,
      };
    },
  };
}
