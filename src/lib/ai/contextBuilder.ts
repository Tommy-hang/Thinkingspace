// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type {
  BehaviorProfile,
  ContextManifest,
  ContextPart,
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
  /** 只发送最近 N 轮对话，避免主题过长 */
  maxTurns?: number;
  /** 联网检索结果，会作为最高优先级的参考资料注入 */
  searchSources?: SearchSource[];
  /** 通过 @ 引用的其它主题，只发送它们的「当前理解」，不发送完整对话 */
  mentionedNodeIds?: string[];
  /** 本次回答解析后的 Behavior Profile（三级作用域的结果） */
  behavior?: BehaviorProfile;
}

export interface BuildContextResult {
  messages: ChatMessage[];
  manifest: ContextManifest;
  /** 稳定前缀原文（system + behavior）——用于算指纹、判断 cache 是否可能失效 */
  stableText: string;
  stableChars: number;
  dynamicChars: number;
}

/**
 * Context Engine：利用树结构，只把「与当前主题真正相关」的内容送给模型。
 * Project Summary → Ancestor Topics → Parent Topic Summary → Current Conversation → Anchor → Question
 *
 * 同时返回一份「上下文透镜」清单，让用户看见 AI 到底用了哪些内容。
 */
export function buildContext(input: BuildContextInput): BuildContextResult {
  const { project, nodes, messages, nodeId, question, settings } = input;
  const maxTurns = input.maxTurns ?? 20;

  const path = ancestorPath(nodes, nodeId);
  const current = path[path.length - 1];

  const out: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  const parts: ContextPart[] = [];
  let totalChars = SYSTEM_PROMPT.length;
  let stableChars = SYSTEM_PROMPT.length;

  const push = (message: ChatMessage, part: ContextPart, stable = false) => {
    out.push(message);
    parts.push({ ...part, chars: message.content.length });
    totalChars += message.content.length;
    if (stable) stableChars += message.content.length;
  };

  // Behavior Profile：控制「如何思考」，与「用哪些内容」分开统计
  if (input.behavior) {
    const behaviorPrompt = buildBehaviorPrompt(input.behavior);
    if (behaviorPrompt) {
      push(
        { role: 'system', content: behaviorPrompt },
        { kind: 'behavior', label: '行为倾向', detail: input.behavior.name },
        true,
      );
    }
  }

  // ⚠️ 稳定前缀到此为止：上面只有「系统规则 + 行为配置」，内容不随对话变化。
  // 下面的项目概述 / 祖先 / 锚点 / 检索 / 引用 / 对话 / 问题都属于动态部分。
  // 保持这个顺序，才能最大化 Provider 上下文缓存的命中率。
  const stableText = out.map((m) => m.content).join('\n');

  if (settings.includeProjectSummary && project.summary) {
    push(
      {
        role: 'system',
        content: `【项目】${project.title}\n【项目概述】${project.summary}`,
      },
      { kind: 'project', label: '项目目标', detail: project.title },
    );
  }

  if (settings.includeAncestorSummaries && path.length > 1) {
    const ancestors = path.slice(0, -1).slice(-settings.ancestorDepth);
    const lines = ancestors.map((n, i) => {
      const summary = n.summary ? ` —— ${truncate(n.summary, settings.maxAncestorChars)}` : '';
      return `${i + 1}. ${n.title}${summary}`;
    });
    push(
      {
        role: 'system',
        content: `【当前主题的上层结构（从总到分）】\n${lines.join('\n')}`,
      },
      {
        kind: 'ancestor',
        label: '上游主题',
        detail: ancestors.map((n) => n.title).join(' → '),
      },
    );
  }

  const anchor = current?.anchor;
  if (anchor?.anchorText) {
    push(
      {
        role: 'system',
        content: `【本主题来自父主题的片段】「${anchor.anchorText}」${
          anchor.parentContextSummary
            ? `\n【父主题摘要】${truncate(anchor.parentContextSummary, settings.maxAncestorChars)}`
            : ''
        }`,
      },
      { kind: 'anchor', label: '分支锚点', detail: clip(anchor.anchorText, 40) },
    );
  }

  if (input.searchSources && input.searchSources.length > 0) {
    push(
      { role: 'system', content: formatSourcesForPrompt(input.searchSources) },
      {
        kind: 'search',
        label: '联网检索结果',
        detail: `${input.searchSources.length} 条`,
      },
    );
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
      push(
        {
          role: 'system',
          content: `【用户 @ 引用的其它主题（来自同一个思考空间）】\n${lines.join(
            '\n',
          )}\n\n请在回答中自然地结合这些已有理解。`,
        },
        {
          kind: 'mention',
          label: '@ 引用的主题',
          detail: mentioned.map((n) => n.title).join('、'),
        },
      );
    }
  }

  const own = messages.filter((m) => m.nodeId === nodeId && !m.error);
  const recent = own.slice(-maxTurns);
  let conversationChars = 0;
  recent.forEach((m) => {
    const message: ChatMessage = {
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    };
    out.push(message);
    conversationChars += message.content.length;
    totalChars += message.content.length;
  });
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
  totalChars += question.length;

  // 同一项目里、本次没有加入的主题（用于「× 其他无关主题未加入」）
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
    dynamicChars: Math.max(0, totalChars - stableChars),
  };
}
