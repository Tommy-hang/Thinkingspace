// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { ProviderConfig } from '../../types';
import { streamMock } from './mock';
import { streamOpenAICompatible } from './openaiCompatible';
import type { ChatMessage, ThinkingOptions } from './types';

export type { ChatMessage, ThinkingOptions } from './types';
export { SYSTEM_PROMPT } from './types';

export interface RunChatInput {
  provider: ProviderConfig;
  apiKey: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
  thinking?: ThinkingOptions;
}

export function requiresApiKey(provider: ProviderConfig): boolean {
  return provider.kind !== 'mock';
}

/** 一次性调用，把流式输出拼成完整字符串（用于生成标题等短任务） */
export async function completeText(
  input: Omit<RunChatInput, 'onDelta' | 'onReasoning'>,
): Promise<string> {
  let out = '';
  await runChat({
    ...input,
    onDelta: (delta) => {
      out += delta;
    },
  });
  return out;
}

export async function runChat(input: RunChatInput): Promise<void> {
  const { provider, apiKey, messages, signal, onDelta, onReasoning, thinking } = input;

  if (requiresApiKey(provider) && !apiKey.trim()) {
    throw new Error(
      `尚未配置「${provider.displayName}」的 API Key。请在 设置 → AI Providers 中填入。`,
    );
  }

  const options = { provider, apiKey, messages, signal, onDelta, onReasoning, thinking };

  switch (provider.kind) {
    case 'mock':
      return streamMock(options);
    case 'openai-compatible':
    default:
      return streamOpenAICompatible(options);
  }
}
