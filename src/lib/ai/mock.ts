import type { StreamChatOptions } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 离线演示 Provider：不联网、不需要 API Key。
 * 用于在没有配置 Key 时完整体验「提问 → 流式回答 → 形成主题」的流程。
 */
export async function streamMock(options: StreamChatOptions): Promise<void> {
  const lastUser = [...options.messages].reverse().find((m) => m.role === 'user');
  const question = lastUser?.content?.trim() ?? '（空问题）';
  const anchor = options.messages.find(
    (m) => m.role === 'system' && m.content.includes('本主题来自父主题的片段'),
  );

  const thinking = [
    `用户的问题是：「${question}」。`,
    anchor ? `\n这个主题来自父主题的一段片段，回答时应当与那段上下文衔接。` : ``,
    `\n我需要组织一个结构清晰的回答，并演示 Markdown 与数学公式的渲染效果。`,
    `\n（以上是离线演示的模拟思考过程；真实模型会在这里输出完整的推理链。）`,
  ]
    .filter(Boolean)
    .join('');

  if (options.onReasoning) {
    for (const ch of thinking) {
      if (options.signal?.aborted) return;
      options.onReasoning(ch);
      await delay(4);
    }
  }

  const reply = [
    `这是「离线演示」模式的回答，用来验证 **Markdown** 与 **数学公式** 的渲染，并未真正调用大模型。`,
    ``,
    `### 你问的是`,
    `> ${question}`,
    ``,
    `### 行内公式`,
    `注意力分数会除以 $\\sqrt{d_k}$，防止点积方差随维度增长而爆炸。`,
    ``,
    `### 块级公式`,
    `$$`,
    `\\operatorname{Attention}(Q,K,V) = \\operatorname{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V`,
    `$$`,
    ``,
    `### 代码`,
    '```python',
    'def scaled_dot_product(q, k, v):',
    '    scores = q @ k.transpose(-2, -1) / (q.size(-1) ** 0.5)',
    '    return scores.softmax(dim=-1) @ v',
    '```',
    ``,
    `### 接下来你可以`,
    `1. 直接追问，继续深入当前主题；`,
    `2. 选中回答里的任意文字 → 点「分支」，生成子主题；`,
    `3. 在设置里填入 DeepSeek Key，即可获得真实回答。`,
  ].join('\n');

  for (const ch of reply) {
    if (options.signal?.aborted) return;
    options.onDelta(ch);
    await delay(6);
  }
}
