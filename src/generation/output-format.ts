/**
 * Structured-output format for the recipe call.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS INSTEAD OF `zodOutputFormat(RecipeSchema)`
 * ---------------------------------------------------------------------------
 * The brief says to build the output format with
 * `zodOutputFormat(RecipeSchema)` from `@anthropic-ai/sdk/helpers/zod`.
 *
 * That helper imports `zod/v4` and calls `z.toJSONSchema()` on the schema it is
 * handed. The frozen contract builds `RecipeSchema` with `import { z } from
 * 'zod'`, which on the installed zod (3.25.76) is the **v3 classic** API. A v3
 * schema has none of the v4 internals, so the helper fails twice over:
 *
 *   - at compile time: `Argument of type 'ZodObject<...>' is not assignable to
 *     parameter of type 'ZodType<unknown, unknown, $ZodTypeInternals<...>>'`
 *   - at runtime:      `TypeError: Cannot read properties of undefined
 *                       (reading 'def')`
 *
 * Fixing that properly means the contract importing from `zod/v4` — a contract
 * change, which is the orchestrator's call, not this agent's. Rather than
 * hand-write a second copy of the recipe shape (which would silently drift from
 * the contract the moment either side changed), this module DERIVES the JSON
 * schema from `RecipeSchema` itself. There is exactly one source of truth for
 * the shape, and it is still the contract.
 *
 * The converter deliberately supports only the constructs the contract actually
 * uses and throws on anything else, so a future contract change surfaces as a
 * loud failure here rather than a quietly wrong schema on the wire.
 */

import type { z } from 'zod';
import { RecipeSchema } from '@contract/recipe.schema';

/** A JSON Schema object, in the strict subset structured outputs accepts. */
export type JsonSchema = Record<string, unknown>;

/**
 * The shape the SDK's `messages.parse()` looks for. When `parse` is present the
 * SDK populates `parsed_output`; when it is absent `parsed_output` is always
 * null. The function is dropped by JSON serialisation, so only `type` and
 * `schema` reach the wire.
 */
export interface RecipeOutputFormat {
  type: 'json_schema';
  schema: JsonSchema;
  parse(content: string): unknown;
}

interface ZodDefLike {
  typeName: string;
  checks?: ReadonlyArray<{ kind: string }>;
  shape?: () => Record<string, unknown>;
  type?: unknown;
  values?: readonly unknown[];
  value?: unknown;
  options?: readonly unknown[];
  innerType?: unknown;
}

function defOf(schema: unknown): ZodDefLike {
  const def = (schema as { _def?: unknown } | undefined)?._def;
  if (def === undefined || def === null || typeof def !== 'object') {
    throw new Error('Not a zod schema: no _def');
  }
  return def as ZodDefLike;
}

/**
 * Structured outputs rejects `null` as a bare type in some positions but always
 * accepts `anyOf`, so nullability is expressed as a union.
 */
function nullable(inner: JsonSchema): JsonSchema {
  return { anyOf: [inner, { type: 'null' }] };
}

/**
 * Convert a zod v3 schema to the strict JSON Schema subset structured outputs
 * supports.
 *
 * Deliberately dropped, because the API does not support them and sending them
 * is a 400: `minLength` / `maxLength` on strings, `minimum` / `maximum` /
 * `multipleOf` on numbers, `minItems` / `maxItems` on arrays. Those constraints
 * still run — `parseAndValidate()` applies the full zod schema to whatever comes
 * back, so `.min(1)` is enforced on our side rather than the model's.
 */
export function zodV3ToJsonSchema(schema: unknown): JsonSchema {
  const def = defOf(schema);

  switch (def.typeName) {
    case 'ZodString':
      return { type: 'string' };

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodNumber': {
      const isInt = (def.checks ?? []).some((c) => c.kind === 'int');
      return { type: isInt ? 'integer' : 'number' };
    }

    case 'ZodLiteral':
      return { const: def.value };

    case 'ZodEnum':
      return { type: 'string', enum: [...(def.values ?? [])] };

    case 'ZodNullable':
      return nullable(zodV3ToJsonSchema(def.innerType));

    case 'ZodOptional':
      // Optionality is expressed by omission from `required`, not in the
      // property schema itself.
      return zodV3ToJsonSchema(def.innerType);

    case 'ZodArray':
      return { type: 'array', items: zodV3ToJsonSchema(def.type) };

    case 'ZodUnion': {
      const options = [...(def.options ?? [])];
      if (options.length === 0) throw new Error('ZodUnion with no options');
      // A union of literals is an enum, which is cheaper for the model to
      // satisfy than an anyOf of consts.
      const allLiterals = options.every((o) => defOf(o).typeName === 'ZodLiteral');
      if (allLiterals) {
        const values = options.map((o) => defOf(o).value);
        const allNumbers = values.every((v) => typeof v === 'number');
        return allNumbers ? { type: 'integer', enum: values } : { enum: values };
      }
      return { anyOf: options.map((o) => zodV3ToJsonSchema(o)) };
    }

    case 'ZodObject': {
      const shapeFn = def.shape;
      if (typeof shapeFn !== 'function') throw new Error('ZodObject without a shape');
      const shape = shapeFn();
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const key of Object.keys(shape)) {
        const child = shape[key];
        properties[key] = zodV3ToJsonSchema(child);
        if (defOf(child).typeName !== 'ZodOptional') required.push(key);
      }
      return {
        type: 'object',
        properties,
        required,
        // Structured outputs requires this on every object.
        additionalProperties: false,
      };
    }

    default:
      throw new Error(
        `zodV3ToJsonSchema: unsupported zod node "${def.typeName}". ` +
          'The contract added a construct this converter does not handle — ' +
          'stop and report it rather than guessing a JSON Schema for it.',
      );
  }
}

/** The recipe JSON Schema, derived from the contract's `RecipeSchema`. */
export const RECIPE_JSON_SCHEMA: JsonSchema = zodV3ToJsonSchema(
  RecipeSchema as unknown as z.ZodTypeAny,
);

/**
 * The output format handed to `client.messages.parse()`.
 *
 * `parse` is deliberately a bare `JSON.parse` rather than a zod parse: shape
 * validation belongs to `parseAndValidate()`, where a failure becomes a
 * `schema_invalid` rejection that feeds the retry prompt. If we validated here,
 * the SDK would throw instead and we would lose the detail.
 */
export function recipeOutputFormat(): RecipeOutputFormat {
  return {
    type: 'json_schema',
    schema: RECIPE_JSON_SCHEMA,
    parse: (content: string): unknown => JSON.parse(content),
  };
}
