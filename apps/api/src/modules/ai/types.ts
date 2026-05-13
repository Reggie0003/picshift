/**
 * AI provider abstraction. The HR assistant module talks to this interface,
 * not to OpenAI/Anthropic directly. That makes it trivial to swap providers
 * or route different prompt categories to different models (e.g. cheap
 * model for chit-chat, premium for payroll-anomaly detection).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  model?: string;
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface AIProvider {
  readonly name: 'anthropic' | 'openai';
  isConfigured(): boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
