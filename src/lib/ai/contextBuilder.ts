import type { ContextSettings, Message, Project, SearchSource, TopicNode } from '../../types';
import { formatSourcesForPrompt } from '../search';
import { SYSTEM_PROMPT, type ChatMessage } from './types';

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

export function ancestorPath(nodes: TopicNode[], nodeId: string): TopicNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: TopicNode[] = [];
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

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
}

/**
 * Context Engine：利用树结构，只把「与当前主题真正相关」的内容送给模型。
 * Project Summary → Ancestor Topics → Parent Topic Summary → Current Conversation → Anchor → Question
 */
export function buildContext(input: BuildContextInput): ChatMessage[] {
  const { project, nodes, messages, nodeId, question, settings } = input;
  const maxTurns = input.maxTurns ?? 20;

  const path = ancestorPath(nodes, nodeId);
  const current = path[path.length - 1];

  const out: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (settings.includeProjectSummary && project.summary) {
    out.push({
      role: 'system',
      content: `【项目】${project.title}\n【项目概述】${project.summary}`,
    });
  }

  if (settings.includeAncestorSummaries && path.length > 1) {
    const ancestors = path.slice(0, -1).slice(-settings.ancestorDepth);
    const lines = ancestors.map((n, i) => {
      const summary = n.summary ? ` —— ${truncate(n.summary, settings.maxAncestorChars)}` : '';
      return `${i + 1}. ${n.title}${summary}`;
    });
    out.push({
      role: 'system',
      content: `【当前主题的上层结构（从总到分）】\n${lines.join('\n')}`,
    });
  }

  const anchor = current?.anchor;
  if (anchor?.anchorText) {
    out.push({
      role: 'system',
      content: `【本主题来自父主题的片段】「${anchor.anchorText}」${
        anchor.parentContextSummary
          ? `\n【父主题摘要】${truncate(anchor.parentContextSummary, settings.maxAncestorChars)}`
          : ''
      }`,
    });
  }

  if (input.searchSources && input.searchSources.length > 0) {
    out.push({
      role: 'system',
      content: formatSourcesForPrompt(input.searchSources),
    });
  }

  const own = messages.filter((m) => m.nodeId === nodeId && !m.error);
  const recent = own.slice(-maxTurns);
  recent.forEach((m) => {
    out.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    });
  });

  out.push({ role: 'user', content: question });
  return out;
}
