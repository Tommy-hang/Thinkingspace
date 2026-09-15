import type { TopicNode } from '../types';

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

/** 因祖先处于折叠状态而不可见的节点 id */
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

/** 地图上当前应该显示的节点 */
export function getVisibleNodes(nodes: TopicNode[]): TopicNode[] {
  const hidden = getCollapsedHiddenIds(nodes);
  return hidden.size === 0 ? nodes : nodes.filter((n) => !hidden.has(n.id));
}

export function hasChildren(nodes: TopicNode[], nodeId: string): boolean {
  return nodes.some((n) => n.parentId === nodeId);
}
