// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { GraphEdge, Message, TopicNode } from '../types';

/**
 * 与 `supabase/schema.sql` 里的容量保护触发器保持一致。
 * 改上限时，两边都要改。
 */
export const USAGE_LIMITS = {
  maxProjects: 20,
  maxTotalBytes: 20 * 1024 * 1024,
  maxProjectBytes: 4 * 1024 * 1024,
};

export interface UsageProject {
  id: string;
  title: string;
  bytes: number;
}

export interface UsageSummary {
  projects: number;
  totalBytes: number;
  largest: UsageProject | null;
}

function byteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
}

/**
 * 估算一个项目在云端占用的体积。
 * 与数据库里的 pg_column_size 不会完全相等，但足够用来提示用户「离上限还有多远」。
 */
export function estimateProjectBytes(
  projectId: string,
  nodes: TopicNode[],
  edges: GraphEdge[],
  messages: Message[],
): number {
  const nodeIds = new Set(nodes.filter((n) => n.projectId === projectId).map((n) => n.id));
  const content = {
    nodes: nodes.filter((n) => n.projectId === projectId),
    edges: edges.filter((e) => e.projectId === projectId),
    messages: messages.filter((m) => nodeIds.has(m.nodeId)),
  };
  return byteLength(JSON.stringify(content));
}

export function summarizeUsage(
  projects: { id: string; title: string }[],
  nodes: TopicNode[],
  edges: GraphEdge[],
  messages: Message[],
): UsageSummary {
  const list: UsageProject[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    bytes: estimateProjectBytes(p.id, nodes, edges, messages),
  }));

  let totalBytes = 0;
  let largest: UsageProject | null = null;
  for (const item of list) {
    totalBytes += item.bytes;
    if (!largest || item.bytes > largest.bytes) largest = item;
  }

  return { projects: projects.length, totalBytes, largest };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
