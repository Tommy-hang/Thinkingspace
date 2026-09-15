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

  const reply = [
    `这是「离线演示」模式的回答，用来验证界面与流程，并未真正调用大模型。`,
    ``,
    `你刚才问的是：**${question}**`,
    ``,
    anchor ? `我注意到这个主题是从父主题的一段内容分支出来的，因此会优先围绕那段上下文来回答。` : ``,
    `在真实模式下（Settings → 选择 DeepSeek 并填入 API Key），这里会返回模型逐字流式生成的回答。`,
    ``,
    `你可以继续：`,
    `1. 直接追问，继续深入当前主题；`,
    `2. 选中回答中的任意文字 → 点「分支」，生成一个新的子主题；`,
    `3. 返回地图，观察思考结构如何生长。`,
  ]
    .filter(Boolean)
    .join('\n');

  for (const ch of reply) {
    if (options.signal?.aborted) return;
    options.onDelta(ch);
    await delay(8);
  }
}
