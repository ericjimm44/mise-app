/**
 * Generation Core — public surface.
 *
 * Pure logic. No UI, no Tailwind, no `.tsx`. Downstream agents import
 * `generateRecipe` and the types; everything else here exists for tests, the
 * audit, and a future server-side proxy.
 */

export { generateRecipe } from './generate';
export type { GenerateOptions } from './generate';
export {
  MAX_ATTEMPTS_CEILING,
  REFUSAL_DETAIL_PREFIX,
  ABORTED_DETAIL_PREFIX,
  isRefusalRejection,
  isAbortRejection,
} from './generate';

export { createAnthropicClient, createRecipeModelClient } from './client';
export type {
  AnthropicLike,
  RecipeModelClient,
  RecipeModelClientOptions,
  RecipeModelRequest,
  RecipeModelResult,
  RefusalInfo,
  SystemBlock,
} from './client';

export {
  AMBITION_RULES,
  buildSystemPrompt,
  buildSystemPromptText,
  buildUserPrompt,
} from './prompt';
export type { AmbitionRules, UserPromptOptions } from './prompt';

export {
  RECIPE_JSON_SCHEMA,
  recipeOutputFormat,
  zodV3ToJsonSchema,
} from './output-format';
export type { JsonSchema, RecipeOutputFormat } from './output-format';

export {
  DEFAULT_MAX_ATTEMPTS,
  FORBIDDEN_REQUEST_FIELDS,
  MAX_TOKENS,
  MODEL,
} from './config';
