// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { ProviderConfig } from '../types';
import { completeText, type ChatMessage } from './ai';
import { clipAtSentence } from './text';

export const TITLE_MAX = 16;

function cleanTitle(raw: string): string {
  let text = raw.trim().split('\n')[0].trim();
  text = text.replace(/^#+\s*/, '');
  text = text.replace(/^(标题|主题|Title)\s*[:：]\s*/i, '');
  text = text.replace(/^["'「『【[(（]+/, '').replace(/["'」』】\])）]+$/, '');
  text = text.replace(/[。．.,，；;：:！!？?]+$/, '');
  return text.slice(0, TITLE_MAX).trim();
}

/** 这些标题只是结构标签，不能当作知识点 */
const GENERIC_HEADING =
  /^(你问的是|你问的|回答|答案|总结|一句话总结|结论|概述|简介|背景|前言|说明|示例|代码|接下来|延伸|补充|附注)$/;

/** 不依赖模型：从回答里提取一个像知识点的短语 */
export function localTitle(question: string, answer: string): string {
  const text = answer || '';

  const headings = [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => cleanTitle(m[1]));
  const heading = headings.find((h) => h.length >= 2 && !GENERIC_HEADING.test(h));
  if (heading) return heading;

  const bold = /\*\*([^*\n]{2,24})\*\*/.exec(text);
  if (bold) {
    const title = cleanTitle(bold[1]);
    if (title.length >= 2) return title;
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(#|>|\||```|-{3,})/.test(line)) continue;
    const sentence = line.split(/[。！？!?；;]/)[0].replace(/[*`_]/g, '');
    const title = cleanTitle(sentence);
    if (title.length >= 2) return title;
  }

  return cleanTitle(question) || '未命名主题';
}

/**
 * 从回答里取一段摘要文字。
 * 会在句子边界处收尾（而不是硬切），避免出现「半截话」。
 */
export function localSummary(answer: string, max = 260): string {
  const text = answer
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clipAtSentence(text, max);
}

export const TITLE_SYSTEM_PROMPT = [
  '你是一个标题生成器。',
  '请根据下面这段「提问 + 回答」，提炼出这段对话真正讨论的**核心知识点**，输出一个简短标题。',
  '要求：',
  '1. 只输出标题本身，不要任何解释、引号或标点装饰；',
  '2. 不超过 14 个汉字（或等长的英文短语）；',
  '3. 必须是知识点式的名词短语，例如「注意力分数的缩放」「QKV 的分工」；',
  '4. 不要把用户的问句直接当标题，也不要写成「关于……的问题」这类空泛形式；',
  '5. 使用与用户相同的语言。',
].join('\n');

export function buildTitleMessages(question: string, answer: string): ChatMessage[] {
  return [
    { role: 'system', content: TITLE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `【提问】\n${question}\n\n【回答】\n${answer.slice(0, 2400)}`,
    },
  ];
}

export async function generateTitle(opts: {
  provider: ProviderConfig;
  apiKey: string;
  question: string;
  answer: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { provider, apiKey, question, answer } = opts;

  if (provider.kind === 'mock' || !apiKey.trim()) {
    return localTitle(question, answer);
  }

  try {
    const raw = await completeText({
      provider,
      apiKey,
      messages: buildTitleMessages(question, answer),
      signal: opts.signal,
      // 生成标题是短任务，关掉深度思考，省时省钱
      thinking: { enabled: false, effort: 'low' },
    });
    const title = cleanTitle(raw);
    return title.length >= 2 ? title : localTitle(question, answer);
  } catch {
    return localTitle(question, answer);
  }
}
