// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { GraphEdge, TopicNode } from '../types';

export function buildChildrenMap(nodes: TopicNode[]): Map<string | null, TopicNode[]> {
  const map = new Map<string | null, TopicNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return map;
}

/** 从根到该节点的祖先链（包含节点自身） */
export function getAncestors(nodes: TopicNode[], nodeId: string): TopicNode[] {
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

export function getAncestorIds(nodes: TopicNode[], nodeId: string): Set<string> {
  return new Set(getAncestors(nodes, nodeId).map((n) => n.id));
}

/** 该节点及其所有后代 */
export function getSubtreeIds(nodes: TopicNode[], rootId: string): Set<string> {
  const children = buildChildrenMap(nodes);
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const child of children.get(id) ?? []) stack.push(child.id);
  }
  return ids;
}

export function getDescendantIds(nodes: TopicNode[], rootId: string): Set<string> {
  const ids = getSubtreeIds(nodes, rootId);
  ids.delete(rootId);
  return ids;
}

/** 因祖先处于折叠状态而不可见的节点 id（不含被折叠的节点自身） */
export function getCollapsedHiddenIds(nodes: TopicNode[]): Set<string> {
  const children = buildChildrenMap(nodes);
  const hidden = new Set<string>();
  const stack: string[] = [];
  for (const n of nodes) {
    if (n.collapsed) stack.push(n.id);
  }
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of children.get(id) ?? []) {
      if (hidden.has(child.id)) continue;
      hidden.add(child.id);
      stack.push(child.id);
    }
  }
  return hidden;
}

/** 因「隐藏自身」而不可见的节点 id（含被隐藏的节点自身及其所有后代） */
export function getHiddenIds(nodes: TopicNode[]): Set<string> {
  const children = buildChildrenMap(nodes);
  const hidden = new Set<string>();
  const stack: string[] = nodes.filter((n) => n.hidden).map((n) => n.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (hidden.has(id)) continue;
    hidden.add(id);
    for (const child of children.get(id) ?? []) stack.push(child.id);
  }
  return hidden;
}

/** 地图上当前应该显示的节点（排除折叠后代与被隐藏的子树） */
export function getVisibleNodes(nodes: TopicNode[]): TopicNode[] {
  const hidden = getHiddenIds(nodes);
  const collapsed = getCollapsedHiddenIds(nodes);
  if (hidden.size === 0 && collapsed.size === 0) return nodes;
  return nodes.filter((n) => !hidden.has(n.id) && !collapsed.has(n.id));
}

export function hasChildren(nodes: TopicNode[], nodeId: string): boolean {
  return nodes.some((n) => n.parentId === nodeId);
}

/**
 * 地图上应当画出来的连线：
 *   1. 父子结构线（source 是 target 的父主题）
 *   2. 综合节点指向其来源主题的引用线
 *
 * 其余连线（早期版本允许用户手动随意拖出来的「引用」线）一律不显示——
 * 它们会让人误以为存在从属关系，从而扰乱对对话结构的理解。
 * 注意：这里只是不显示，并不会删除数据。
 */
export function getMeaningfulEdges(edges: GraphEdge[], nodes: TopicNode[]): GraphEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return edges.filter((e) => {
    const target = byId.get(e.target);
    if (target && target.parentId === e.source) return true;
    return Boolean(byId.get(e.source)?.synthesis);
  });
}
