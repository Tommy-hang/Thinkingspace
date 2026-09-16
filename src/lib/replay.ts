// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { Message, Project, ReplayEvent, TopicNode } from '../types';
import { NODE_STATUS } from '../types';

export interface ThoughtReplay {
  events: ReplayEvent[];
  startAt: number;
  endAt: number;
  /** 最终形成的理解（已收敛且有结论的主题） */
  conclusions: { id: string; title: string; summary: string }[];
  /** 被搁置或隐藏的分支 */
  abandoned: { id: string; title: string; reason: string }[];
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

/**
 * 思考回放：只根据已有的时间戳推导「这棵树是怎么长出来的」，不引入任何新数据。
 *
 * 能看到：最初的问题、第一个分支、哪次对话改变了「当前理解」、
 * 哪些分支被搁置、最后形成了什么结论。
 */
export function buildThoughtReplay(
  project: Project,
  nodes: TopicNode[],
  messages: Message[],
): ThoughtReplay {
  const projectNodes = nodes.filter((n) => n.projectId === project.id);
  const events: ReplayEvent[] = [];

  events.push({
    at: project.createdAt,
    kind: 'project',
    title: `创建了「${project.title}」`,
    detail: project.summary ? truncate(project.summary, 80) : undefined,
  });

  for (const n of projectNodes) {
    const firstQuestion = messages.find((m) => m.nodeId === n.id && m.role === 'user');

    if (n.parentId === null) {
      events.push({
        at: n.createdAt,
        kind: 'topic',
        nodeId: n.id,
        title: `新建主题「${n.title}」`,
        detail: firstQuestion ? truncate(firstQuestion.content, 80) : undefined,
      });
    } else {
      events.push({
        at: n.createdAt,
        kind: 'branch',
        nodeId: n.id,
        title: `开出分支「${n.title}」`,
        detail: n.anchor?.anchorText
          ? `锚点：「${truncate(n.anchor.anchorText, 60)}」`
          : firstQuestion
            ? truncate(firstQuestion.content, 80)
            : undefined,
      });
    }

    if (n.summaryUpdatedAt) {
      events.push({
        at: n.summaryUpdatedAt,
        kind: 'understanding',
        nodeId: n.id,
        title: `更新了「${n.title}」的当前理解`,
        detail: n.summary ? truncate(n.summary, 90) : undefined,
      });
    }

    if (n.insightUpdatedAt && n.insight) {
      events.push({
        at: n.insightUpdatedAt,
        kind: 'insight',
        nodeId: n.id,
        title: `综合了「${n.title}」的子分支`,
        detail: truncate(n.insight, 90),
      });
    }
  }

  events.sort((a, b) => a.at - b.at);

  const conclusions = projectNodes
    .filter((n) => n.status === 'resolved' && n.summary.trim())
    .map((n) => ({ id: n.id, title: n.title, summary: n.summary }));

  const abandoned = projectNodes
    .filter((n) => n.status === 'parked' || n.hidden)
    .map((n) => ({
      id: n.id,
      title: n.title,
      reason: n.hidden ? '已隐藏' : NODE_STATUS[n.status].label,
    }));

  const startAt = events.length > 0 ? events[0].at : project.createdAt;
  const endAt = events.length > 0 ? events[events.length - 1].at : project.updatedAt;

  return { events, startAt, endAt, conclusions, abandoned };
}
