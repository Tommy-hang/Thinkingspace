// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { GraphEdge, Message, Project, TopicNode } from '../types';
import { uid } from './id';
import { getSubtreeIds } from './tree';

/**
 * 跨项目搬运一条分支（主题卡片 + 它的全部子分支）。
 *
 * 拆分为两个纯函数，只做数据变换、不接触 UI 与 store：
 *   - moveSubtreeToProject  把子树「移动」到另一个项目（从原项目移除）
 *   - copySubtreeToProject  把子树「复制」到另一个项目（原项目不变）
 *
 * 两个函数的入参/返回都是同一份「工作区切片」，因此可以单独做单元测试。
 */
export interface WorkspaceSlice {
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
}

/** 克隆出来的一个完整项目（含它的全部内容） */
export interface ClonedProject {
  project: Project;
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
}

/**
 * 把一个项目整体克隆一份（生成全新的 id），用于同步冲突时「保留另一份」。
 *
 * 与 copySubtreeToProject 的区别：这里克隆的是**整个项目**（可能有多棵根主题），
 * 而且不改变原数据，只把克隆出来的片段交给调用方去合并。
 */
export function cloneProject(
  slice: WorkspaceSlice,
  projectId: string,
  overrides: { title?: string; id?: string } = {},
): ClonedProject | null {
  const source = slice.projects.find((p) => p.id === projectId);
  if (!source) return null;

  const now = Date.now();
  const sourceNodes = slice.nodes.filter((n) => n.projectId === projectId);
  const nodeIds = new Set(sourceNodes.map((n) => n.id));

  const nodeMap = new Map<string, string>();
  for (const id of nodeIds) nodeMap.set(id, uid('n_'));

  const newProjectId = overrides.id ?? uid('p_');

  const nodes: TopicNode[] = sourceNodes.map((n) => ({
    ...n,
    id: nodeMap.get(n.id)!,
    projectId: newProjectId,
    parentId: n.parentId && nodeMap.has(n.parentId) ? nodeMap.get(n.parentId)! : null,
    anchor: n.anchor
      ? {
          ...n.anchor,
          sourceNodeId: nodeMap.get(n.anchor.sourceNodeId) ?? n.anchor.sourceNodeId,
        }
      : undefined,
    createdAt: now,
    updatedAt: now,
  }));

  const edges: GraphEdge[] = slice.edges
    .filter((e) => e.projectId === projectId)
    .map((e) => ({
      ...e,
      id: uid('e_'),
      projectId: newProjectId,
      source: nodeMap.get(e.source) ?? e.source,
      target: nodeMap.get(e.target) ?? e.target,
      createdAt: now,
    }));

  const messageMap = new Map<string, string>();
  const messages: Message[] = slice.messages
    .filter((m) => nodeIds.has(m.nodeId))
    .map((m) => {
      const id = uid('m_');
      messageMap.set(m.id, id);
      return { ...m, id, nodeId: nodeMap.get(m.nodeId)!, pending: false };
    });

  const project: Project = {
    ...source,
    id: newProjectId,
    title: overrides.title ?? source.title,
    openQuestions: (source.openQuestions ?? []).map((q) => ({
      ...q,
      id: uid('q_'),
      sourceNodeId: q.sourceNodeId
        ? (nodeMap.get(q.sourceNodeId) ?? q.sourceNodeId)
        : undefined,
      sourceMessageId: q.sourceMessageId ? messageMap.get(q.sourceMessageId) : undefined,
    })),
    // 新项目还没有和云端建立版本对应关系，等下一次同步时作为新项目上传
    cloudRevision: undefined,
    cloudUpdatedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  return { project, nodes, edges, messages };
}

/**
 * 把 nodeId 及其所有后代移动到 targetProjectId。
 *
 * 规则：
 * - 子树根节点脱离原来的父节点（parentId 置空），成为目标项目里的顶层主题；
 *   后代之间的父子关系保持不变。
 * - 两端都在子树内的连线随节点一起搬走；跨出边界的连线（例如与旧父节点相连）
 *   会被删除，因为它在新项目里已经没有意义。
 * - 对话挂在节点上，随节点一起走，不需要改动。
 * - 「待解决问题」来源在本子树内的，会跟着一起搬到目标项目。
 */
export function moveSubtreeToProject(
  slice: WorkspaceSlice,
  nodeId: string,
  targetProjectId: string,
): WorkspaceSlice | null {
  const node = slice.nodes.find((n) => n.id === nodeId);
  const target = slice.projects.find((p) => p.id === targetProjectId);
  if (!node || !target || node.projectId === targetProjectId) return null;

  const now = Date.now();
  const sourceProjectId = node.projectId;
  const subtree = getSubtreeIds(slice.nodes, nodeId);

  const sourceProject = slice.projects.find((p) => p.id === sourceProjectId);
  const movedQuestions = (sourceProject?.openQuestions ?? []).filter(
    (q) => q.sourceNodeId && subtree.has(q.sourceNodeId),
  );
  const movedQuestionIds = new Set(movedQuestions.map((q) => q.id));

  const nodes = slice.nodes.map((n) =>
    subtree.has(n.id)
      ? {
          ...n,
          projectId: targetProjectId,
          parentId: n.id === nodeId ? null : n.parentId,
          updatedAt: now,
        }
      : n,
  );

  const edges = slice.edges
    .filter((e) => {
      const sourceInside = subtree.has(e.source);
      const targetInside = subtree.has(e.target);
      // 两端都在子树内（保留并迁移）或都在外面（保留在原地）；
      // 只有「跨出边界」的连线需要删除。
      return sourceInside === targetInside;
    })
    .map((e) => (subtree.has(e.source) ? { ...e, projectId: targetProjectId } : e));

  const projects = slice.projects.map((p) => {
    if (p.id === targetProjectId) {
      return {
        ...p,
        openQuestions: [...(p.openQuestions ?? []), ...movedQuestions],
        updatedAt: now,
      };
    }
    if (p.id === sourceProjectId) {
      return {
        ...p,
        openQuestions: (p.openQuestions ?? []).filter((q) => !movedQuestionIds.has(q.id)),
        updatedAt: now,
      };
    }
    return p;
  });

  return { projects, nodes, edges, messages: slice.messages };
}

/**
 * 把 nodeId 及其所有后代复制到 targetProjectId。
 *
 * 会为所有复制出来的节点、连线、对话生成新的 id，因此两个项目里可以并存、
 * 互不影响。子树根的父节点同样置空。原项目（含它的待解决问题）完全不变。
 */
export function copySubtreeToProject(
  slice: WorkspaceSlice,
  nodeId: string,
  targetProjectId: string,
): WorkspaceSlice | null {
  const node = slice.nodes.find((n) => n.id === nodeId);
  const target = slice.projects.find((p) => p.id === targetProjectId);
  if (!node || !target || node.projectId === targetProjectId) return null;

  const now = Date.now();
  const subtree = getSubtreeIds(slice.nodes, nodeId);

  const idMap = new Map<string, string>();
  for (const id of subtree) idMap.set(id, uid('n_'));

  const copiedNodes: TopicNode[] = slice.nodes
    .filter((n) => subtree.has(n.id))
    .map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      projectId: targetProjectId,
      parentId:
        n.id === nodeId
          ? null
          : n.parentId && idMap.has(n.parentId)
            ? idMap.get(n.parentId)!
            : null,
      anchor: n.anchor
        ? {
            ...n.anchor,
            sourceNodeId: idMap.get(n.anchor.sourceNodeId) ?? n.anchor.sourceNodeId,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    }));

  const copiedEdges: GraphEdge[] = slice.edges
    .filter((e) => subtree.has(e.source) && subtree.has(e.target))
    .map((e) => ({
      ...e,
      id: uid('e_'),
      projectId: targetProjectId,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      createdAt: now,
    }));

  const copiedMessages: Message[] = slice.messages
    .filter((m) => subtree.has(m.nodeId))
    .map((m) => ({
      ...m,
      id: uid('m_'),
      nodeId: idMap.get(m.nodeId)!,
      // 复制出来的内容不应再显示为「生成中」
      pending: false,
    }));

  const projects = slice.projects.map((p) =>
    p.id === targetProjectId ? { ...p, updatedAt: now } : p,
  );

  return {
    projects,
    nodes: [...slice.nodes, ...copiedNodes],
    edges: [...slice.edges, ...copiedEdges],
    messages: [...slice.messages, ...copiedMessages],
  };
}
