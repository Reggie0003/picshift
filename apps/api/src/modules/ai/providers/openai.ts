import { env } from '@/config/env.js';
import { ApiError } from '@/lib/errors.js';
import type { AIProvider, CompletionRequest, CompletionResult } from '@/modules/ai/types.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (!this.isConfigured()) throw ApiError.notImplemented('OpenAI API key not configured');

    const model = req.model ?? 'gpt-4o-mini';
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.2,
        messages: [
          { role: 'system', content: req.systemPrompt },
          ...req.messages,
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw ApiError.internal(`OpenAI ${resp.status}: ${body.slice(0, 200)}`);
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    const result: CompletionResult = {
      text,
      model: data.model ?? model,
    };
    if (data.usage) {
      result.usage = {
        inputTokens: data.usage.prompt_tokens ?? 0,
        outputTokens: data.usage.completion_tokens ?? 0,
      };
    }
    return result;
  }
}
