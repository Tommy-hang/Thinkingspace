import type { ProviderConfig } from '../../types';
import { streamMock } from './mock';
import { streamOpenAICompatible } from './openaiCompatible';
import type { ChatMessage } from './types';

export type { ChatMessage } from './types';
export { SYSTEM_PROMPT } from './types';

export interface RunChatInput {
  provider: ProviderConfig;
  apiKey: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export function requiresApiKey(provider: ProviderConfig): boolean {
  return provider.kind !== 'mock';
}

export async function runChat(input: RunChatInput): Promise<void> {
  const { provider, apiKey, messages, signal, onDelta } = input;

  if (requiresApiKey(provider) && !apiKey.trim()) {
    throw new Error(
      `尚未配置「${provider.displayName}」的 API Key。请在 设置 → AI Providers 中填入。`,
    );
  }

  const options = { provider, apiKey, messages, signal, onDelta };

  switch (provider.kind) {
    case 'mock':
      return streamMock(options);
    case 'openai-compatible':
    default:
      return streamOpenAICompatible(options);
  }
}
