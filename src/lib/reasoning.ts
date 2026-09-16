// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { BranchIntent, BranchSuggestion, ProviderConfig, TopicNode } from '../types';
import { INTENT_META, INTENT_ORDER } from './branchIntent';
import { localSummary, localTitle, TITLE_MAX } from './title';
import { extractJson, str } from './json';
import { completeText, type ChatMessage } from './ai';

/** 深度思考对这类短任务没有帮助，反而更慢更贵 */
const FAST_THINKING = { enabled: false, effort: 'low' as const };

async function ask(
  provider: ProviderConfig,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string | null> {
  if (provider.kind === 'mock' || !apiKey.trim()) return null;
  try {
    return await completeText({ provider, apiKey, messages, signal, thinking: FAST_THINKING });
  } catch {
    return null;
  }
}

/* ============================ Topic Digest ============================ */

export interface TopicDigest {
  title: string;
  summary: string;
}

const DIGEST_PROMPT = [
  '你是知识整理助手。请阅读下面这段对话，输出一个 JSON 对象：',
  '{',
  '  "title": "这段对话真正讨论的核心知识点，不超过 14 个汉字，名词性短语，不要用问句",',
  '  "summary": "用 3-5 句完整的话说明这个主题目前形成了什么结论"',
  '}',
  '',
  '对 summary 的要求：',
  '1. 直接讲结论，不要写「本文讨论了…」「这段对话…」这类开场；',
  '2. 每一句都必须说完整，绝对不要出现半截话、省略号或没说完的句子；',
  '3. 不要为了简短而省略关键信息——宁可多写一句，也不要把话说到一半。',
  '',
  '只输出 JSON，不要任何解释或代码块标记。使用与对话相同的语言。',
].join('\n');

export async function generateDigest(opts: {
  provider: ProviderConfig;
  apiKey: string;
  content: string;
  fallbackQuestion: string;
  fallbackAnswer: string;
  signal?: AbortSignal;
}): Promise<TopicDigest> {
  const { provider, apiKey, content, fallbackQuestion, fallbackAnswer } = opts;

  const raw = await ask(
    provider,
    apiKey,
    [
      { role: 'system', content: DIGEST_PROMPT },
      { role: 'user', content: content.slice(0, 12000) },
    ],
    opts.signal,
  );

  if (raw) {
    const parsed = extractJson(raw) as { title?: unknown; summary?: unknown } | null;
    const title = str(parsed?.title).slice(0, TITLE_MAX);
    const summary = str(parsed?.summary);
    if (title.length >= 2 || summary) {
      return {
        title: title.length >= 2 ? title : localTitle(fallbackQuestion, fallbackAnswer),
        summary: summary || localSummary(fallbackAnswer),
      };
    }
  }

  return {
    title: localTitle(fallbackQuestion, fallbackAnswer),
    summary: localSummary(fallbackAnswer),
  };
}

/* ============================ Suggested Branches ============================ */

const SUGGEST_PROMPT = [
  '你是研究助手。根据下面这段对话，提出 3 个最值得继续探索的方向。',
  '每个方向必须从下列思考类型中选择一个：',
  INTENT_ORDER.filter((i) => i !== 'custom')
    .map((i) => `- ${i}（${INTENT_META[i].label}：${INTENT_META[i].hint}）`)
    .join('\n'),
  '',
  '输出 JSON 数组，不要任何解释或代码块标记：',
  '[{"intent":"why","label":"不超过 10 字的短标签","question":"完整的问题，会直接发给 AI"}]',
  'label 要具体到这段对话的内容，不要写成「为什么」这种空泛的词。',
].join('\n');

export function localSuggestions(question: string, answer: string): BranchSuggestion[] {
  const anchor = localTitle(question, answer);
  return [
    {
      intent: 'why',
      label: `${anchor}的原因`,
      question: `为什么「${anchor}」会这样？请解释背后的原因和机制。`,
    },
    {
      intent: 'example',
      label: `${anchor}的例子`,
      question: `请给出一个具体、可验证的例子来说明「${anchor}」。`,
    },
    {
      intent: 'counterexample',
      label: `${anchor}的局限`,
      question: `「${anchor}」在什么条件下不成立？有哪些反例或局限？`,
    },
  ];
}

export async function generateSuggestions(opts: {
  provider: ProviderConfig;
  apiKey: string;
  question: string;
  answer: string;
  signal?: AbortSignal;
}): Promise<BranchSuggestion[]> {
  const { provider, apiKey, question, answer } = opts;

  const raw = await ask(
    provider,
    apiKey,
    [
      { role: 'system', content: SUGGEST_PROMPT },
      {
        role: 'user',
        content: `【提问】\n${question}\n\n【回答】\n${answer.slice(0, 2400)}`,
      },
    ],
    opts.signal,
  );

  if (raw) {
    const parsed = extractJson(raw);
    if (Array.isArray(parsed)) {
      const valid = new Set<BranchIntent>(INTENT_ORDER);
      const list: BranchSuggestion[] = [];
      for (const item of parsed) {
        const obj = item as { intent?: unknown; label?: unknown; question?: unknown };
        const intent = str(obj.intent) as BranchIntent;
        const question = str(obj.question);
        if (!valid.has(intent) || intent === 'custom' || !question) continue;
        list.push({
          intent,
          label: str(obj.label) || INTENT_META[intent].label,
          question,
        });
        if (list.length >= 4) break;
      }
      if (list.length > 0) return list;
    }
  }

  return localSuggestions(question, answer);
}

/* ============================ Merge Insights ============================ */

const INSIGHT_PROMPT = [
  '你是研究助手。用户在一个主题下展开了若干子分支，各自形成了理解。',
  '请把这些探索综合成一段「当前理解」，说明现在可以怎样更完整地理解这个主题。',
  '要求：',
  '1. 不要罗列分支名称或写成清单，要形成一个连贯的结论；',
  '2. 指出各分支之间如何相互支撑或相互制约；',
  '3. 控制在 400 字以内，但每一句都要说完整，不要出现半截话；',
  '4. 只输出这段理解本身，不要任何前言。',
].join('\n');

export function localInsight(topicTitle: string, children: TopicNode[]): string {
  const parts = children
    .filter((c) => c.summary.trim())
    .map((c) => `- ${c.title}：${c.summary}`);
  if (parts.length === 0) return '';
  return `围绕「${topicTitle}」，目前的探索可以概括为：\n${parts.join('\n')}`;
}

export async function generateInsight(opts: {
  provider: ProviderConfig;
  apiKey: string;
  topicTitle: string;
  topicSummary: string;
  children: TopicNode[];
  signal?: AbortSignal;
}): Promise<string> {
  const { provider, apiKey, topicTitle, topicSummary, children } = opts;

  const body = [
    `【主题】${topicTitle}`,
    topicSummary ? `【已有概述】${topicSummary}` : '',
    '',
    '【子分支】',
    ...children.map(
      (c) =>
        `- ${c.title}${c.intent ? `（${INTENT_META[c.intent]?.label ?? ''}）` : ''}\n  ${
          c.summary || '（暂无概述）'
        }`,
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await ask(
    provider,
    apiKey,
    [
      { role: 'system', content: INSIGHT_PROMPT },
      { role: 'user', content: body.slice(0, 12000) },
    ],
    opts.signal,
  );

  const text = str(raw);
  if (text.length >= 10) return text;
  return localInsight(topicTitle, children);
}

/* ============================ Synthesis（综合节点） ============================ */

export interface SynthesisResult {
  title: string;
  conclusion: string;
  contradictions: string;
}

const SYNTHESIS_PROMPT = [
  '你是研究助手。用户在一个思考空间里探索了若干相关主题，每个主题都有自己的「当前理解」。',
  '请把它们收敛成一个更高层的统一认识，输出 JSON：',
  '{',
  '  "title": "这次综合真正形成的知识点，不超过 14 个汉字，名词性短语",',
  '  "conclusion": "综合后的统一理解，3-5 句完整的话；要讲出各主题之间如何相互支撑或相互制约，不要罗列，也不要出现半截话",',
  '  "contradictions": "这些主题之间尚未解决的矛盾、分歧或缺口；没有就留空字符串"',
  '}',
  '只输出 JSON，不要任何解释或代码块标记。使用与内容相同的语言。',
].join('\n');

export function localSynthesis(
  sources: { title: string; summary: string }[],
): SynthesisResult {
  const parts = sources
    .filter((s) => s.summary.trim())
    .map((s) => `- ${s.title}：${s.summary}`);
  const joined = sources.map((s) => s.title).join(' + ');
  return {
    // 标题宁可换成概括说法，也不要在词中间切断
    title: joined.length <= TITLE_MAX ? joined : `综合 ${sources.length} 个主题`,
    conclusion: parts.length
      ? `把这几条线索放在一起，目前可以这样理解：\n${parts.join('\n')}`
      : '',
    contradictions: '',
  };
}

export async function generateSynthesis(opts: {
  provider: ProviderConfig;
  apiKey: string;
  projectTitle: string;
  sources: { title: string; summary: string }[];
  signal?: AbortSignal;
}): Promise<SynthesisResult> {
  const { provider, apiKey, projectTitle, sources } = opts;

  const body = [
    `【思考空间】${projectTitle}`,
    '',
    '【待综合的主题与当前理解】',
    ...sources.map((s) => `### ${s.title}\n${s.summary || '（暂无概述）'}`),
  ].join('\n');

  const raw = await ask(
    provider,
    apiKey,
    [
      { role: 'system', content: SYNTHESIS_PROMPT },
      { role: 'user', content: body.slice(0, 16000) },
    ],
    opts.signal,
  );

  if (raw) {
    const parsed = extractJson(raw) as {
      title?: unknown;
      conclusion?: unknown;
      contradictions?: unknown;
    } | null;
    const title = str(parsed?.title).slice(0, TITLE_MAX);
    const conclusion = str(parsed?.conclusion);
    if (conclusion.length >= 10) {
      return {
        title: title.length >= 2 ? title : localSynthesis(sources).title,
        conclusion,
        contradictions: str(parsed?.contradictions),
      };
    }
  }

  return localSynthesis(sources);
}
