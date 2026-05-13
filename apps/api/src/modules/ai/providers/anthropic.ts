/**
 * Anthropic adapter. Uses the official Messages API.
 *
 * Note: this implementation uses `fetch` rather than the @anthropic-ai/sdk
 * package to keep the API container slim. Switch to the SDK if you want
 * streaming token deltas for the HR assistant chat UI.
 */
import { env } from '@/config/env.js';
import { ApiError } from '@/lib/errors.js';
import type { AIProvider, CompletionRequest, CompletionResult } from '@/modules/ai/types.js';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  isConfigured(): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (!this.isConfigured()) throw ApiError.notImplemented('Anthropic API key not configured');

    const model = req.model ?? 'claude-haiku-4-5-20251001';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.2,
        system: req.systemPrompt,
        messages: req.messages.filter((m) => m.role !== 'system'),
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw ApiError.internal(`Anthropic ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    const result: CompletionResult = {
      text,
      model: data.model ?? model,
    };
    if (data.usage) {
      result.usage = {
        inputTokens: data.usage.input_tokens ?? 0,
        outputTokens: data.usage.output_tokens ?? 0,
      };
    }
    return result;
  }
}
