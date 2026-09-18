// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type {
  BehaviorProfile,
  ContextManifest,
  ContextPart,
  ContextInspector,
  ContextSettings,
  Message,
  Project,
  SearchSource,
  TopicNode,
} from '../../types';
import { buildBehaviorPrompt } from '../behavior';
import { formatSourcesForPrompt } from '../search';
import { clipAtSentence } from '../text';
import { getAncestors } from '../tree';
import {
  collectMemories,
  extractFeatures,
  planContext,
  rankByRelevance,
  retrieveHistory,
  tokenize,
  type ContextPlan,
  type RequestFeatures,
} from './contextPlanner';
import { SYSTEM_PROMPT, type ChatMessage } from './types';

/** 展示用（上下文透镜清单）：直接截断即可 */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

/** 送入模型的内容：尽量截在句子边界，避免半截话影响 AI 理解 */
function truncate(text: string, max: number): string {
  return clipAtSentence(text, max);
}

export const ancestorPath = getAncestors;

export interface BuildContextInput {
  project: Project;
  nodes: TopicNode[];
  messages: Message[];
  nodeId: string;
  question: string;
  settings: ContextSettings;
  searchSources?: SearchSource[];
  mentionedNodeIds?: string[];
  behavior?: BehaviorProfile;
  /** V2：是否启用上下文规划（依赖检测 / 检索 / 预算）。关闭后回到 V1 行为 */
  intelligence?: boolean;
}

export interface BuildContextResult {
  messages: ChatMessage[];
  manifest: ContextManifest;
  /** 稳定前缀原文（system + behavior）——用于算指纹 */
  stableText: string;
  stableChars: number;
  dynamicChars: number;
  plan: ContextPlan;
  features: RequestFeatures;
  inspector: ContextInspector;
}

interface Candidate {
  kind: ContextPart['kind'];
  label: string;
  detail?: string;
  content: string;
  /** 越大越优先保留 */
  priority: number;
}

/** 动态内容的固定输出顺序（保持稳定，避免打乱缓存） */
const KIND_ORDER: ContextPart['kind'][] = [
  'project',
  'ancestor',
  'anchor',
  'search',
  'behavior',
  'mention',
  'conversation',
  'question',
];

export function buildContext(input: BuildContextInput): BuildContextResult {
  const { project, nodes, messages, nodeId, question, settings } = input;
  const intelligence = input.intelligence ?? true;

  const path = ancestorPath(nodes, nodeId);
  const current = path[path.length - 1];

  // ---------- 1. 稳定前缀（顺序固定、内容不随对话变化）----------
  const stable: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (input.behavior) {
    const behaviorPrompt = buildBehaviorPrompt(input.behavior);
    if (behaviorPrompt) stable.push({ role: 'system', content: behaviorPrompt });
  }
  const stableText = stable.map((m) => m.content).join('\n');
  const stableChars = stableText.length;

  // ---------- 2. 请求分析 + 上下文规划 ----------
  const own = messages.filter((m) => m.nodeId === nodeId && !m.error);
  const priorTurns = Math.ceil(own.length / 2);
  const features = extractFeatures(question, priorTurns);
  const plan = planContext(features, own.length);

  const recentTurns = intelligence ? plan.recentTurns : 20;
  const recent = own.slice(-recentTurns);

  // ---------- 3. 收集候选动态内容 ----------
  const candidates: Candidate[] = [];

  if (settings.includeProjectSummary && project.summary) {
    candidates.push({
      kind: 'project',
      label: '项目目标',
      detail: project.title,
      content: `【项目】${project.title}\n【项目概述】${project.summary}`,
      priority: 60,
    });
  }

  if (settings.includeAncestorSummaries && path.length > 1) {
    const ancestors = path.slice(0, -1).slice(-settings.ancestorDepth);
    const lines = ancestors.map((n, i) => {
      const summary = n.summary ? ` —— ${truncate(n.summary, settings.maxAncestorChars)}` : '';
      return `${i + 1}. ${n.title}${summary}`;
    });
    candidates.push({
      kind: 'ancestor',
      label: '上游主题',
      detail: ancestors.map((n) => n.title).join(' → '),
      content: `【当前主题的上层结构（从总到分）】\n${lines.join('\n')}`,
      priority: 75,
    });
  }

  const anchor = current?.anchor;
  if (anchor?.anchorText) {
    candidates.push({
      kind: 'anchor',
      label: '分支锚点',
      detail: clip(anchor.anchorText, 40),
      content: `【本主题来自父主题的片段】「${anchor.anchorText}」${
        anchor.parentContextSummary
          ? `\n【父主题摘要】${truncate(anchor.parentContextSummary, settings.maxAncestorChars)}`
          : ''
      }`,
      priority: 90,
    });
  }

  if (input.searchSources && input.searchSources.length > 0) {
    candidates.push({
      kind: 'search',
      label: '联网检索结果',
      detail: `${input.searchSources.length} 条`,
      content: formatSourcesForPrompt(input.searchSources),
      priority: 100,
    });
  }

  if (input.mentionedNodeIds && input.mentionedNodeIds.length > 0) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const mentioned = input.mentionedNodeIds
      .map((id) => byId.get(id))
      .filter((n): n is TopicNode => Boolean(n) && n!.id !== nodeId);
    const lines = mentioned.map((n) => {
      const understanding = n.insight || n.summary;
      return `- 《${n.title}》${understanding ? `：${truncate(understanding, 400)}` : '（尚无概述）'}`;
    });
    if (lines.length > 0) {
      candidates.push({
        kind: 'mention',
        label: '@ 引用的主题',
        detail: mentioned.map((n) => n.title).join('、'),
        content: `【用户 @ 引用的其它主题（来自同一个思考空间）】\n${lines.join(
          '\n',
        )}\n\n请在回答中自然地结合这些已有理解。`,
        priority: 88,
      });
    }
  }

  // ---------- 4. 检索：长期记忆 + 较早的历史消息 ----------
  const queryTokens = tokenize(question);
  let memoryCount = 0;
  let historyCount = 0;

  if (intelligence && plan.retrieveMemory) {
    const memories = collectMemories(project, nodes, nodeId);
    const top = rankByRelevance(
      memories,
      queryTokens,
      (m) => m.text,
      (m) => m.importance,
      () => Date.now(),
      plan.maxMemory,
    );
    if (top.length > 0) {
      memoryCount = top.length;
      candidates.push({
        kind: 'mention',
        label: '长期记忆',
        detail: top.map((t) => t.item.text.split('：')[0]).join('、'),
        content: `【这个思考空间里已经形成的理解（按相关度挑选）】\n${top
          .map((t) => `- ${truncate(t.item.text, 300)}`)
          .join('\n')}`,
        priority: 70,
      });
    }
  }

  if (intelligence && plan.retrieveHistory) {
    const earlier = own.slice(0, Math.max(0, own.length - recentTurns));
    const top = retrieveHistory(earlier, queryTokens, plan.maxHistory);
    if (top.length > 0) {
      historyCount = top.length;
      candidates.push({
        kind: 'conversation',
        label: '较早的相关记录',
        detail: `${top.length} 条`,
        content: `【本主题较早、且与当前问题相关的对话片段】\n${top
          .map((t) => `${t.item.role === 'user' ? '我' : 'AI'}：${truncate(t.item.content, 400)}`)
          .join('\n\n')}`,
        priority: 55,
      });
    }
  }

  // ---------- 5. 预算：按优先级取舍 ----------
  const conversationChars = recent.reduce((sum, m) => sum + m.content.length, 0);
  const coreChars = conversationChars + question.length;
  const budget = intelligence ? plan.maxDynamicChars : Number.MAX_SAFE_INTEGER;
  let remaining = Math.max(0, budget - coreChars);

  const availableChars =
    candidates.reduce((sum, c) => sum + c.content.length, 0) + coreChars;

  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const selected: Candidate[] = [];
  let excludedChars = 0;
  for (const c of sorted) {
    if (c.content.length <= remaining) {
      selected.push(c);
      remaining -= c.content.length;
    } else {
      excludedChars += c.content.length;
    }
  }

  // ---------- 6. 按固定顺序组装 ----------
  const out: ChatMessage[] = [...stable];
  const parts: ContextPart[] = [];

  if (input.behavior) {
    const behaviorPrompt = buildBehaviorPrompt(input.behavior);
    if (behaviorPrompt) {
      parts.push({
        kind: 'behavior',
        label: '行为倾向',
        detail: input.behavior.name,
        chars: behaviorPrompt.length,
      });
    }
  }

  const ordered = selected.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  for (const c of ordered) {
    out.push({ role: 'system', content: c.content });
    parts.push({ kind: c.kind, label: c.label, detail: c.detail, chars: c.content.length });
  }

  for (const m of recent) {
    out.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    });
  }
  if (recent.length > 0) {
    parts.push({
      kind: 'conversation',
      label: '本主题对话',
      detail: `${Math.ceil(recent.length / 2)} 轮`,
      chars: conversationChars,
    });
  }

  out.push({ role: 'user', content: question });
  parts.push({
    kind: 'question',
    label: '当前问题',
    detail: clip(question, 36),
    chars: question.length,
  });

  const dynamicChars = parts.reduce((sum, p) => sum + (p.chars ?? 0), 0);
  const totalChars = stableChars + dynamicChars;

  const included = new Set<string>(path.map((n) => n.id));
  for (const id of input.mentionedNodeIds ?? []) included.add(id);
  const excludedTopics = nodes.filter(
    (n) => n.projectId === project.id && !included.has(n.id),
  ).length;

  return {
    messages: out,
    manifest: { parts, excludedTopics, totalChars },
    stableText,
    stableChars,
    dynamicChars,
    plan,
    features,
    inspector: {
      availableChars,
      selectedChars: totalChars - stableChars - excludedChars,
      excludedChars,
      memoryCount,
      historyCount,
      historyDependency: plan.historyDependency,
    },
  };
}
