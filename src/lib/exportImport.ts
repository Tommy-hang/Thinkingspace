// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type {
  ExportBundle,
  GraphEdge,
  Message,
  PersistedData,
  Project,
  TopicNode,
} from '../types';
import { uid } from './id';

export function buildBundle(
  data: Pick<PersistedData, 'projects' | 'nodes' | 'edges' | 'messages'>,
  projectIds?: string[],
): ExportBundle {
  const keep = projectIds ? new Set(projectIds) : null;
  const projects = keep ? data.projects.filter((p) => keep.has(p.id)) : data.projects;
  const ids = new Set(projects.map((p) => p.id));
  const nodes = data.nodes.filter((n) => ids.has(n.projectId));
  const nodeIds = new Set(nodes.map((n) => n.id));
  return {
    format: 'thinkingspace',
    version: 1,
    exportedAt: Date.now(),
    projects,
    nodes,
    edges: data.edges.filter((e) => ids.has(e.projectId)),
    messages: data.messages.filter((m) => nodeIds.has(m.nodeId)),
  };
}

export function downloadBundle(bundle: ExportBundle, filename: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportedData {
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
}

export function parseBundle(text: string): ImportedData {
  const raw = JSON.parse(text) as Partial<ExportBundle>;
  if (!raw || raw.format !== 'thinkingspace' || !Array.isArray(raw.projects)) {
    throw new Error('不是有效的 ThinkingSpace 导出文件。');
  }
  const projects = raw.projects ?? [];
  const nodes = raw.nodes ?? [];
  const edges = raw.edges ?? [];
  const messages = raw.messages ?? [];

  const projectMap = new Map<string, string>();
  projects.forEach((p) => projectMap.set(p.id, uid('p_')));
  const nodeMap = new Map<string, string>();
  nodes.forEach((n) => nodeMap.set(n.id, uid('n_')));

  const now = Date.now();

  const newProjects: Project[] = projects.map((p) => ({
    ...p,
    id: projectMap.get(p.id)!,
    title: p.title,
    createdAt: p.createdAt ?? now,
    updatedAt: now,
  }));

  const newNodes: TopicNode[] = nodes.map((n) => ({
    ...n,
    id: nodeMap.get(n.id)!,
    projectId: projectMap.get(n.projectId) ?? n.projectId,
    parentId: n.parentId ? (nodeMap.get(n.parentId) ?? null) : null,
    anchor: n.anchor
      ? {
          ...n.anchor,
          sourceNodeId: nodeMap.get(n.anchor.sourceNodeId) ?? n.anchor.sourceNodeId,
        }
      : undefined,
    createdAt: n.createdAt ?? now,
    updatedAt: now,
  }));

  const newEdges: GraphEdge[] = edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      ...e,
      id: uid('e_'),
      projectId: projectMap.get(e.projectId) ?? e.projectId,
      source: nodeMap.get(e.source)!,
      target: nodeMap.get(e.target)!,
      createdAt: now,
    }));

  const newMessages: Message[] = messages
    .filter((m) => nodeMap.has(m.nodeId))
    .map((m) => ({
      ...m,
      id: uid('m_'),
      nodeId: nodeMap.get(m.nodeId)!,
      pending: false,
      createdAt: m.createdAt ?? now,
    }));

  return {
    projects: newProjects,
    nodes: newNodes,
    edges: newEdges,
    messages: newMessages,
  };
}
