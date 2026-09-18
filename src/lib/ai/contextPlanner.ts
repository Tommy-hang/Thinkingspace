// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { ContextPartKind, Message, Project, TopicNode } from '../../types';

/**
 * Context Intelligence（V2）——**只提供规则与检索**，不调用任何模型。
 *
 * 目标：把「把整段历史发给模型」换成「只提供完成当前任务所需的信息」。
 * 所有决策都可以解释，且全部可测试。
 */

export type HistoryDependency = 'none' | 'low' | 'medium' | 'high';

/** 明显指代上文的说法 */
const REFERENCE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /刚才|刚刚|上次|之前|前面|上面|上述|前面说|刚说/, label: '指代前文' },
  { re: /继续|接着|接下来|往下|再说说/, label: '要求继续' },
  { re: /那个|这个方案|该方案|那种|此法|这个思路|这一版/, label: '指代前述对象' },
  { re: /按照(之前|上面|刚才)|基于(之前|上面)|根据(之前|上面)/, label: '依赖先前约定' },
  { re: /你(说|提到|给出)的|刚才那(个|段|条)/, label: '指代模型先前回答' },
];

const CONSTRAINT_RE = /(必须|不要|不能|需要|要求|限制|只能|务必|禁止|不超过|至少)/g;

export interface RequestFeatures {
  questionChars: number;
  hasCode: boolean;
  hasMath: boolean;
  constraintCount: number;
  questionCount: number;
  historyDependency: HistoryDependency;
  dependencyHits: string[];
}

/** 判断当前问题在多大程度上依赖上文 */
export function detectHistoryDependency(
  question: string,
  priorTurnCount: number,
): { level: HistoryDependency; hits: string[] } {
  if (priorTurnCount === 0) return { level: 'none', hits: [] };

  const hits = REFERENCE_PATTERNS.filter((p) => p.re.test(question)).map((p) => p.label);
  if (hits.length >= 2) return { level: 'high', hits };
  if (hits.length === 1) return { level: 'medium', hits };

  // 没有显式指代：问题越短，越可能是在接着上一轮说
  const len = question.trim().length;
  if (len <= 12) return { level: 'medium', hits: [] };
  if (len <= 30) return { level: 'low', hits: [] };
  return { level: 'none', hits: [] };
}

export function extractFeatures(question: string, priorTurnCount: number): RequestFeatures {
  const dependency = detectHistoryDependency(question, priorTurnCount);
  return {
    questionChars: question.trim().length,
    hasCode: /```|function |const |import |class |<\w+>|\bdef \b|\bSELECT\b/i.test(question),
    hasMath: /\$|\\\(|\\\[|积分|微分|矩阵|概率|证明|推导|方程/.test(question),
    constraintCount: (question.match(CONSTRAINT_RE) ?? []).length,
    questionCount: (question.match(/[？?]/g) ?? []).length,
    historyDependency: dependency.level,
    dependencyHits: dependency.hits,
  };
}

export interface ContextPlan {
  historyDependency: HistoryDependency;
  /** 保留最近多少条消息原文 */
  recentTurns: number;
  /** 是否检索更早的历史消息 */
  retrieveHistory: boolean;
  /** 是否检索长期记忆（其它主题的理解、待解决问题等） */
  retrieveMemory: boolean;
  /** 动态上下文的最大字数预算 */
  maxDynamicChars: number;
  /** 最多召回多少条历史 / 记忆 */
  maxHistory: number;
  maxMemory: number;
}

const DEPENDENCY_ORDER: HistoryDependency[] = ['none', 'low', 'medium', 'high'];

export function planContext(features: RequestFeatures, turnCount: number): ContextPlan {
  const level = features.historyDependency;
  const rank = DEPENDENCY_ORDER.indexOf(level);

  const recentTurns = [2, 4, 6, 10][rank];
  const maxDynamicChars = [6000, 9000, 14000, 20000][rank];
  const retrieveHistory = rank >= 2 && turnCount > recentTurns + 2;
  const retrieveMemory = rank >= 1 || features.questionChars >= 24;

  return {
    historyDependency: level,
    recentTurns: Math.min(recentTurns, Math.max(2, turnCount)),
    retrieveHistory,
    retrieveMemory,
    maxDynamicChars,
    maxHistory: rank >= 3 ? 4 : 2,
    maxMemory: rank >= 2 ? 6 : 3,
  };
}

/* ============================ 轻量检索（词法，不依赖向量库） ============================ */

/**
 * 中英文混合分词：ASCII 单词 + 中文二元组。
 * 不引入分词库，也不需要 embedding —— 在本地、零成本、可解释。
 * （真正的向量检索留给 V3，届时再接 pgvector。）
 */
export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/[a-z0-9_]{2,}/g)) out.add(m[0]);
  for (const seg of lower.replace(/[^\u4e00-\u9fa5]+/g, ' ').split(/\s+/)) {
    for (let i = 0; i < seg.length - 1; i += 1) out.add(seg.slice(i, i + 2));
    if (seg.length === 1) out.add(seg);
  }
  return out;
}

/** 词法相关度 0~1 */
export function lexicalScore(queryTokens: Set<string>, text: string): number {
  if (queryTokens.size === 0) return 0;
  const doc = tokenize(text);
  if (doc.size === 0) return 0;
  let hit = 0;
  for (const t of queryTokens) if (doc.has(t)) hit += 1;
  return hit / queryTokens.size;
}

export interface MemoryItem {
  id: string;
  namespace: 'project' | 'understanding' | 'open-question' | 'synthesis';
  text: string;
  sourceNodeId?: string;
  /** 基础重要度 0~1 */
  importance: number;
}

const NAMESPACE_LABEL: Record<MemoryItem['namespace'], string> = {
  project: '项目',
  understanding: '其它主题的理解',
  'open-question': '待解决问题',
  synthesis: '综合结论',
};

export function namespaceLabel(ns: MemoryItem['namespace']): string {
  return NAMESPACE_LABEL[ns];
}

/**
 * 从**已有数据**里构造记忆条目 —— 不额外存一份、不额外调模型。
 * 记忆来源：项目概述、其它主题的「当前理解」、未解决的待解决问题、综合结论。
 */
export function collectMemories(
  project: Project,
  nodes: TopicNode[],
  currentNodeId: string,
): MemoryItem[] {
  const items: MemoryItem[] = [];

  if (project.summary.trim()) {
    items.push({
      id: `mem_project_${project.id}`,
      namespace: 'project',
      text: `${project.title}：${project.summary}`,
      importance: 0.5,
    });
  }

  for (const n of nodes) {
    if (n.id === currentNodeId || n.projectId !== project.id) continue;
    const understanding = n.insight || n.summary;
    if (understanding.trim()) {
      items.push({
        id: `mem_node_${n.id}`,
        namespace: n.synthesis ? 'synthesis' : 'understanding',
        text: `${n.title}：${understanding}`,
        sourceNodeId: n.id,
        importance: n.synthesis ? 0.8 : 0.6,
      });
    }
  }

  for (const q of project.openQuestions ?? []) {
    if (q.resolved || !q.text.trim()) continue;
    items.push({
      id: `mem_q_${q.id}`,
      namespace: 'open-question',
      text: `尚未解决：${q.text}`,
      sourceNodeId: q.sourceNodeId,
      importance: 0.7,
    });
  }

  return items;
}

export interface RetrievedItem<T> {
  item: T;
  score: number;
}

/**
 * 检索排序：相关度 × 重要度，再叠加一点时间近因。
 * 简单、可解释、零成本 —— 先跑起来，再谈学习排序。
 */
export function rankByRelevance<T>(
  items: T[],
  queryTokens: Set<string>,
  getText: (item: T) => string,
  getImportance: (item: T) => number,
  getRecency: (item: T) => number,
  limit: number,
): RetrievedItem<T>[] {
  const now = Date.now();
  const scored = items.map((item) => {
    const relevance = lexicalScore(queryTokens, getText(item));
    const recency = 1 / (1 + Math.max(0, now - getRecency(item)) / (7 * 24 * 3600 * 1000));
    const score = relevance * 0.7 + getImportance(item) * 0.2 + recency * 0.1;
    return { item, score, relevance };
  });

  // 必须与当前问题有实际词法相关度，才值得放进上下文
  return scored
    .filter((s) => s.relevance > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ item: s.item, score: s.score }));
}

/** 从较早的历史消息里检索与当前问题最相关的若干条 */
export function retrieveHistory(
  messages: Message[],
  queryTokens: Set<string>,
  limit: number,
): RetrievedItem<Message>[] {
  const candidates = messages.filter((m) => m.content.trim().length > 0);
  return rankByRelevance(
    candidates,
    queryTokens,
    (m) => m.content,
    () => 0.5,
    (m) => m.createdAt,
    limit,
  );
}

export type { ContextPartKind };
