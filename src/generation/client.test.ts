import { describe, expect, it } from 'vitest';
import type { AnthropicLike } from './client';
import { createRecipeModelClient } from './client';
import { FORBIDDEN_REQUEST_FIELDS, MAX_TOKENS, MODEL } from './config';

interface Captured {
  params: Record<string, unknown>;
  options: { signal?: AbortSignal } | undefined;
}

function fakeAnthropic(
  response: Record<string, unknown>,
): { anthropic: AnthropicLike; calls: Captured[] } {
  const calls: Captured[] = [];
  const anthropic: AnthropicLike = {
    messages: {
      async parse(params, options) {
        calls.push({ params, options });
        return response;
      },
    },
  };
  return { anthropic, calls };
}

const SYSTEM = [{ type: 'text' as const, text: 'system', cache_control: { type: 'ephemeral' as const } }];

describe('createRecipeModelClient', () => {
  it('sends the exact model id and max_tokens, and nothing that 400s on this model', async () => {
    const { anthropic, calls } = fakeAnthropic({
      stop_reason: 'end_turn',
      parsed_output: { title: 'x' },
    });

    await createRecipeModelClient({ anthropic }).complete({
      system: SYSTEM,
      userPrompt: 'make dinner',
    });

    const params = calls[0]?.params ?? {};
    expect(params['model']).toBe('claude-opus-5');
    expect(params['model']).toBe(MODEL);
    expect(params['max_tokens']).toBe(MAX_TOKENS);

    // temperature / top_p / top_k are removed on this model and any value is a
    // 400. `thinking` is omitted so adaptive runs by default.
    for (const field of FORBIDDEN_REQUEST_FIELDS) {
      expect(params).not.toHaveProperty(field);
    }
  });

  it('uses structured outputs rather than asking for JSON in prose', async () => {
    const { anthropic, calls } = fakeAnthropic({ stop_reason: 'end_turn', parsed_output: {} });

    await createRecipeModelClient({ anthropic }).complete({
      system: SYSTEM,
      userPrompt: 'make dinner',
    });

    const outputConfig = calls[0]?.params['output_config'] as
      | { format?: { type?: string; schema?: Record<string, unknown> } }
      | undefined;
    expect(outputConfig?.format?.type).toBe('json_schema');
    expect(outputConfig?.format?.schema).toBeDefined();
    expect(outputConfig?.format?.schema?.['type']).toBe('object');
  });

  it('never prefills the assistant turn', async () => {
    const { anthropic, calls } = fakeAnthropic({ stop_reason: 'end_turn', parsed_output: {} });

    await createRecipeModelClient({ anthropic }).complete({
      system: SYSTEM,
      userPrompt: 'make dinner',
    });

    const messages = calls[0]?.params['messages'] as Array<{ role: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    expect(messages.some((m) => m.role === 'assistant')).toBe(false);
  });

  it('passes the system blocks through with the cache breakpoint intact', async () => {
    const { anthropic, calls } = fakeAnthropic({ stop_reason: 'end_turn', parsed_output: {} });

    await createRecipeModelClient({ anthropic }).complete({
      system: SYSTEM,
      userPrompt: 'make dinner',
    });

    expect(calls[0]?.params['system']).toBe(SYSTEM);
  });

  it('reports a refusal instead of reading content', async () => {
    const { anthropic } = fakeAnthropic({
      stop_reason: 'refusal',
      stop_details: { category: 'cyber', explanation: 'nope' },
      // A refusal is an HTTP 200 with empty content. Indexing content[0]
      // unconditionally would throw here.
      content: [],
    });

    const result = await createRecipeModelClient({ anthropic }).complete({
      system: SYSTEM,
      userPrompt: 'make dinner',
    });

    expect(result.stopReason).toBe('refusal');
    expect(result.refusal).toEqual({ category: 'cyber', explanation: 'nope' });
    expect(result.parsedOutput).toBeNull();
  });

  it('normalises a missing parsed_output to null rather than undefined', async () => {
    const { anthropic } = fakeAnthropic({ stop_reason: 'end_turn' });

    const result = await createRecipeModelClient({ anthropic }).complete({
      system: SYSTEM,
      userPrompt: 'make dinner',
    });

    expect(result.parsedOutput).toBeNull();
    expect(result.refusal).toBeNull();
  });

  it('forwards an abort signal and omits the options object when there is none', async () => {
    const controller = new AbortController();
    const { anthropic, calls } = fakeAnthropic({ stop_reason: 'end_turn', parsed_output: {} });
    const client = createRecipeModelClient({ anthropic });

    await client.complete({ system: SYSTEM, userPrompt: 'a', signal: controller.signal });
    await client.complete({ system: SYSTEM, userPrompt: 'b' });

    expect(calls[0]?.options?.signal).toBe(controller.signal);
    expect(calls[1]?.options).toBeUndefined();
  });
});
