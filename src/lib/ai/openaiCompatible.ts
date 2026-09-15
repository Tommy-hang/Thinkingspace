import type { StreamChatOptions } from './types';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * 兼容 OpenAI /chat/completions 协议的流式调用。
 * DeepSeek、OpenAI、OpenRouter、以及任何 OpenAI-compatible 服务都可复用。
 */
export async function streamOpenAICompatible(options: StreamChatOptions): Promise<void> {
  const { provider, apiKey, messages, signal, onDelta, onReasoning, thinking } = options;

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    stream: true,
  };

  // DeepSeek：思考模式由参数控制，而不是靠换模型名
  if (provider.thinkingStyle === 'deepseek' && thinking) {
    body.thinking = { type: thinking.enabled ? 'enabled' : 'disabled' };
    body.reasoning_effort = thinking.effort;
  }

  const res = await fetch(joinUrl(provider.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

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
        };
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
