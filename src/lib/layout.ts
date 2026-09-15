import type { TopicNode } from '../types';

export interface LayoutOptions {
  xGap?: number;
  yGap?: number;
}

/**
 * 简单的分层树布局：横轴表示深度（第几层分支），纵轴表示同层顺序。
 * 不依赖任何外部图布局库，保证节点不会重叠。
 */
export function layoutTree(
  nodes: TopicNode[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const xGap = options.xGap ?? 340;
  const yGap = options.yGap ?? 168;

  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<string, string[]>();
  nodes.forEach((n) => children.set(n.id, []));

  const roots: string[] = [];
  nodes.forEach((n) => {
    if (n.parentId && ids.has(n.parentId)) {
      children.get(n.parentId)!.push(n.id);
    } else {
      roots.push(n.id);
    }
  });

  const depth = new Map<string, number>();
  const yOf = new Map<string, number>();
  const visited = new Set<string>();
  let row = 0;

  const walk = (id: string, d: number): number => {
    if (visited.has(id)) return yOf.get(id) ?? 0;
    visited.add(id);
    depth.set(id, d);

    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      const y = row * yGap;
      row += 1;
      yOf.set(id, y);
      return y;
    }

    const ys = kids.map((k) => walk(k, d + 1));
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    yOf.set(id, y);
    return y;
  };

  roots.forEach((r) => walk(r, 0));
  nodes.forEach((n) => {
    if (!visited.has(n.id)) walk(n.id, 0);
  });

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    positions.set(n.id, {
      x: (depth.get(n.id) ?? 0) * xGap,
      y: yOf.get(n.id) ?? 0,
    });
  });
  return positions;
}
