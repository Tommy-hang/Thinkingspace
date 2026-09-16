// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { Message, TopicNode } from '../types';
import { getSubtreeIds } from './tree';

function safeFilename(name: string): string {
  return (name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'topic').slice(0, 60);
}

/**
 * 把一个 Topic 及其所有子分支导出为 Markdown。
 * 第一版只做结构化导出，不做 AI 总结。
 */
export function exportBranchMarkdown(
  nodes: TopicNode[],
  messages: Message[],
  rootId: string,
): string {
  const root = nodes.find((n) => n.id === rootId);
  if (!root) return '';

  const subtree = getSubtreeIds(nodes, rootId);
  const childrenOf = new Map<string, TopicNode[]>();
  const byNode = new Map<string, Message[]>();

  for (const n of nodes) {
    if (!subtree.has(n.id) || n.id === rootId) continue;
    const key = n.parentId ?? '';
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(n);
  }
  for (const m of messages) {
    if (!subtree.has(m.nodeId)) continue;
    if (!byNode.has(m.nodeId)) byNode.set(m.nodeId, []);
    byNode.get(m.nodeId)!.push(m);
  }

  const lines: string[] = [];

  const walk = (node: TopicNode, depth: number) => {
    const level = Math.min(depth + 1, 6);
    lines.push(`${'#'.repeat(level)} ${node.title || '未命名主题'}`);
    lines.push('');

    if (node.anchor?.anchorText) {
      const source = nodes.find((n) => n.id === node.anchor?.sourceNodeId);
      lines.push(
        `> 来自「${source?.title ?? '父主题'}」：${node.anchor.anchorText}`,
      );
      lines.push('');
    }

    if (node.summary) {
      lines.push(`*${node.summary}*`);
      lines.push('');
    }

    for (const m of byNode.get(node.id) ?? []) {
      const body = m.content.trim();
      if (!body) continue;
      lines.push(m.role === 'user' ? '**我：**' : '**AI：**');
      lines.push('');
      lines.push(body);
      lines.push('');
      if (m.sources && m.sources.length > 0) {
        lines.push('参考来源：');
        m.sources.forEach((s, i) => lines.push(`${i + 1}. [${s.title || s.url}](${s.url})`));
        lines.push('');
      }
    }

    for (const child of childrenOf.get(node.id) ?? []) walk(child, depth + 1);
  };

  walk(root, 0);

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function downloadMarkdown(text: string, title: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
