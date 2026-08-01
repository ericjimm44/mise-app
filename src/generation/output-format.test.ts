import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RecipeSchema } from '@contract/recipe.schema';
import {
  RECIPE_JSON_SCHEMA,
  recipeOutputFormat,
  zodV3ToJsonSchema,
  type JsonSchema,
} from './output-format';
import { validCandidate } from './test-fixtures';

function walk(node: unknown, visit: (schema: JsonSchema) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const entry of node) walk(entry, visit);
    return;
  }
  const schema = node as JsonSchema;
  visit(schema);
  for (const value of Object.values(schema)) walk(value, visit);
}

describe('zodV3ToJsonSchema', () => {
  it('derives the recipe schema from the contract, so the two cannot drift', () => {
    const contractKeys = Object.keys(RecipeSchema.shape).sort();
    const derivedKeys = Object.keys(
      RECIPE_JSON_SCHEMA['properties'] as Record<string, unknown>,
    ).sort();
    expect(derivedKeys).toEqual(contractKeys);
    expect(RECIPE_JSON_SCHEMA['type']).toBe('object');
  });

  it('sets additionalProperties: false on every object, as structured outputs requires', () => {
    let objectCount = 0;
    walk(RECIPE_JSON_SCHEMA, (schema) => {
      if (schema['type'] === 'object') {
        objectCount += 1;
        expect(schema['additionalProperties']).toBe(false);
        expect(Array.isArray(schema['required'])).toBe(true);
      }
    });
    // recipe, difficulty, skill, equipment, substitution, time, ingredient, step
    expect(objectCount).toBeGreaterThanOrEqual(8);
  });

  it('omits constraints the API does not support and would 400 on', () => {
    const unsupported = [
      'minLength',
      'maxLength',
      'minimum',
      'maximum',
      'exclusiveMinimum',
      'multipleOf',
      'minItems',
      'maxItems',
    ];
    walk(RECIPE_JSON_SCHEMA, (schema) => {
      for (const key of unsupported) {
        expect(schema).not.toHaveProperty(key);
      }
    });
  });

  it('keeps optional ingredient fields out of `required`', () => {
    const properties = RECIPE_JSON_SCHEMA['properties'] as Record<string, JsonSchema>;
    const ingredient = (properties['ingredients'] as JsonSchema)['items'] as JsonSchema;
    const required = ingredient['required'] as string[];

    expect(required).toContain('item');
    expect(required).toContain('from_inventory');
    expect(required).not.toContain('substitute');
    expect(required).not.toContain('is_pantry_staple');
    expect(required).not.toContain('prep');

    const ingredientProps = ingredient['properties'] as Record<string, JsonSchema>;
    expect(Object.keys(ingredientProps)).toContain('substitute');
  });

  it('expresses nullability as an anyOf union rather than a bare null type', () => {
    const properties = RECIPE_JSON_SCHEMA['properties'] as Record<string, JsonSchema>;
    const step = (properties['steps'] as JsonSchema)['items'] as JsonSchema;
    const stepProps = step['properties'] as Record<string, JsonSchema>;

    expect(stepProps['technique_id']).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
    expect(stepProps['timer_seconds']).toEqual({
      anyOf: [{ type: 'integer' }, { type: 'null' }],
    });
  });

  it('turns enums and literal unions into enums', () => {
    const properties = RECIPE_JSON_SCHEMA['properties'] as Record<string, JsonSchema>;
    expect(properties['ambition']).toEqual({
      type: 'string',
      enum: ['weeknight', 'elevated', 'project'],
    });

    const difficulty = properties['difficulty'] as JsonSchema;
    const stars = (difficulty['properties'] as Record<string, JsonSchema>)['stars'];
    expect(stars).toEqual({ type: 'integer', enum: [1, 2, 3, 4, 5] });
  });

  it('marks integer fields as integer, not number', () => {
    const properties = RECIPE_JSON_SCHEMA['properties'] as Record<string, JsonSchema>;
    expect(properties['servings']).toEqual({ type: 'integer' });
    const time = (properties['time'] as JsonSchema)['properties'] as Record<string, JsonSchema>;
    expect(time['active_minutes']).toEqual({ type: 'integer' });
  });

  it('throws loudly on a construct it does not understand, rather than guessing', () => {
    expect(() => zodV3ToJsonSchema(z.date())).toThrow(/unsupported zod node/);
    expect(() => zodV3ToJsonSchema(z.record(z.string()))).toThrow(/unsupported zod node/);
    expect(() => zodV3ToJsonSchema({})).toThrow(/Not a zod schema/);
  });
});

describe('recipeOutputFormat', () => {
  it('is the json_schema shape the SDK looks for', () => {
    const format = recipeOutputFormat();
    expect(format.type).toBe('json_schema');
    expect(format.schema).toEqual(RECIPE_JSON_SCHEMA);
    expect(typeof format.parse).toBe('function');
  });

  it('drops the parse function on the wire, leaving only type and schema', () => {
    const onTheWire = JSON.parse(JSON.stringify(recipeOutputFormat())) as Record<string, unknown>;
    expect(Object.keys(onTheWire).sort()).toEqual(['schema', 'type']);
  });

  it('parses without validating, so a bad shape becomes a rejection rather than a throw', () => {
    const format = recipeOutputFormat();
    // Shape validation belongs to parseAndValidate(), where the failure detail
    // can be fed back into the retry prompt.
    expect(format.parse('{"title":"not a recipe"}')).toEqual({ title: 'not a recipe' });
    expect(() => format.parse('not json at all')).toThrow();
  });

  it('round-trips a candidate that the contract schema accepts', () => {
    const parsed = recipeOutputFormat().parse(JSON.stringify(validCandidate()));
    expect(RecipeSchema.safeParse(parsed).success).toBe(true);
  });
});
