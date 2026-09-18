// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { StreamChatOptions } from './types';
import type { RawUsage } from './usage';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * 把 OpenAI 风格的 `usage` 解析成**与厂商无关**的 RawUsage。
 * 不同厂商字段名不同（例如 DeepSeek 用 `prompt_cache_hit_tokens` 表示缓存命中），
 * 这些差异只允许出现在这一层。
 */
function parseUsage(usage: unknown): RawUsage | null {
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const promptDetails = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  const completionDetails = (u.completion_tokens_details ?? {}) as Record<string, unknown>;

  const raw: RawUsage = {
    promptTokens: num(u.prompt_tokens),
    completionTokens: num(u.completion_tokens),
    totalTokens: num(u.total_tokens),
    reasoningTokens: num(completionDetails.reasoning_tokens) ?? num(u.reasoning_tokens),
    cachedTokens:
      num(promptDetails.cached_tokens) ?? num(u.prompt_cache_hit_tokens),
  };

  if (
    raw.promptTokens === undefined &&
    raw.completionTokens === undefined &&
    raw.totalTokens === undefined
  ) {
    return null;
  }
  return raw;
}

/**
 * 兼容 OpenAI /chat/completions 协议的流式调用。
 * DeepSeek、OpenAI、OpenRouter、以及任何 OpenAI-compatible 服务都可复用。
 */
export async function streamOpenAICompatible(options: StreamChatOptions): Promise<void> {
  const { provider, apiKey, messages, signal, onDelta, onReasoning, thinking, maxTokens, onUsage } =
    options;

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    stream: true,
    // 让服务端在流结束时附带 token 用量
    stream_options: { include_usage: true },
  };

  if (typeof maxTokens === 'number' && maxTokens > 0) {
    body.max_tokens = maxTokens;
  }

  // DeepSeek：思考模式由参数控制，而不是靠换模型名
  if (provider.thinkingStyle === 'deepseek' && thinking) {
    body.thinking = { type: thinking.enabled ? 'enabled' : 'disabled' };
    if (thinking.enabled) body.reasoning_effort = thinking.effort;
  }

  const url = joinUrl(provider.baseUrl, 'chat/completions');
  const send = (payload: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

  let res = await send(body);

  // 少数自建的 OpenAI 兼容端点不认识 stream_options，会直接返回 400 —— 去掉再试一次
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    const fallback = { ...body };
    delete fallback.stream_options;
    res = await send(fallback);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const text = await res.text();
      detail = text.slice(0, 400);
    } catch {
      /* ignore */
    }
    throw new Error(`请求失败（HTTP ${res.status}）。${detail}`);
  }

  if (!res.body) {
    throw new Error('服务端没有返回可读取的数据流。');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload) as {
          choices?: {
            delta?: {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
            };
          }[];
          usage?: unknown;
        };

        // 用量块通常出现在最后一片，此时 choices 为空，必须先于 delta 判断
        const usage = parseUsage(json.usage);
        if (usage && onUsage) onUsage(usage);

        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        const reasoning = delta.reasoning_content ?? delta.reasoning;
        if (reasoning && onReasoning) onReasoning(reasoning);
        if (delta.content) onDelta(delta.content);
      } catch {
        /* 忽略无法解析的心跳片段 */
      }
    }
  }
}
