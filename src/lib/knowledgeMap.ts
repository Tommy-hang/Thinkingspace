// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { KnowledgeMap, KnowledgePoint, ProviderConfig } from '../types';
import { uid } from './id';
import { extractJson, str } from './json';
import { completeText } from './ai';

export interface KnowledgeSourceItem {
  id: string;
  title: string;
  summary: string;
}

const MAX_PER_LEVEL = 10;

const KNOWLEDGE_PROMPT = [
  '你是知识结构整理助手。下面是用户在同一个思考空间里探索过的所有主题，以及每个主题的「当前理解」。',
  '',
  '请把这些内容整理成一张**知识点思维导图**，输出 JSON：',
  '{',
  '  "root": "整个思考空间的核心主题，不超过 12 字",',
  '  "children": [',
  '    {',
  '      "label": "知识点名称，不超过 16 字",',
  '      "sources": ["这条知识点来自哪个主题（必须使用下面给出的主题标题原文）"],',
  '      "children": [ /* 可选，最多再往下两层 */ ]',
  '    }',
  '  ]',
  '}',
  '',
  '要求：',
  '1. 只保留**知识本身**，不要出现「主题」「讨论」「问题」「本文」这类词；',
  '2. 按逻辑层次组织：根 → 主要领域（3-6 个）→ 具体知识点（每个领域 2-6 个）；',
  '3. 每个知识点必须标注来源主题，sources 里用上面给出的标题原文；',
  '4. 总知识点数量控制在 15-40 个之间，不要超过 40 个；',
  '5. 只输出 JSON，不要任何解释或代码块标记；',
  '6. 使用与内容相同的语言。',
].join('\n');

function resolveSourceIds(title: string, items: KnowledgeSourceItem[]): string[] {
  const exact = items.filter((i) => i.title === title);
  if (exact.length > 0) return exact.map((i) => i.id);
  const partial = items.filter(
    (i) => i.title.includes(title) || (title.length >= 2 && title.includes(i.title)),
  );
  return partial.map((i) => i.id);
}

function parsePoints(raw: unknown, items: KnowledgeSourceItem[], depth = 0): KnowledgePoint[] {
  if (!Array.isArray(raw) || depth > 3) return [];
  const out: KnowledgePoint[] = [];

  for (const entry of raw) {
    if (out.length >= MAX_PER_LEVEL) break;
    const obj = entry as { label?: unknown; sources?: unknown; children?: unknown };
    const label = str(obj.label).slice(0, 24);
    if (!label) continue;

    const ids = new Set<string>();
    if (Array.isArray(obj.sources)) {
      for (const source of obj.sources) {
        for (const id of resolveSourceIds(str(source), items)) ids.add(id);
      }
    }

    out.push({
      id: uid('k_'),
      label,
      sourceNodeIds: [...ids],
      children: parsePoints(obj.children, items, depth + 1),
    });
  }

  return out;
}

/** 没有配置模型时的兜底：直接用主题标题搭一棵两层树 */
export function localKnowledgeMap(
  projectTitle: string,
  items: KnowledgeSourceItem[],
): KnowledgeMap {
  return {
    generatedAt: Date.now(),
    root: {
      id: uid('k_'),
      label: projectTitle.trim() || '思考空间',
      sourceNodeIds: [],
      children: items.map((item) => ({
        id: uid('k_'),
        label: item.title,
        sourceNodeIds: [item.id],
        children: [],
      })),
    },
  };
}

export interface KnowledgeMapInput {
  provider: ProviderConfig;
  apiKey: string;
  projectTitle: string;
  items: KnowledgeSourceItem[];
  signal?: AbortSignal;
}

export async function generateKnowledgeMap(
  input: KnowledgeMapInput,
): Promise<KnowledgeMap> {
  const { provider, apiKey, projectTitle, items } = input;
  if (items.length === 0) return localKnowledgeMap(projectTitle, items);

  if (provider.kind !== 'mock' && apiKey.trim()) {
    const body = items
      .map((item) => `### ${item.title}\n${item.summary}`)
      .join('\n\n')
      .slice(0, 14000);

    try {
      const raw = await completeText({
        provider,
        apiKey,
        messages: [
          { role: 'system', content: KNOWLEDGE_PROMPT },
          {
            role: 'user',
            content: `【思考空间】${projectTitle}\n\n【主题与当前理解】\n${body}`,
          },
        ],
        signal: input.signal,
        thinking: { enabled: false, effort: 'low' },
      });

      const parsed = extractJson(raw) as { root?: unknown; children?: unknown } | null;
      const rootLabel = str(parsed?.root);
      const children = parsePoints(parsed?.children, items);
      if (rootLabel && children.length > 0) {
        return {
          generatedAt: Date.now(),
          root: {
            id: uid('k_'),
            label: rootLabel.slice(0, 20),
            sourceNodeIds: [],
            children,
          },
        };
      }
    } catch {
      /* 回退到本地兜底 */
    }
  }

  return localKnowledgeMap(projectTitle, items);
}

export interface FlatKnowledgePoint {
  point: KnowledgePoint;
  parentId: string | null;
  depth: number;
}

export function flattenKnowledge(root: KnowledgePoint): FlatKnowledgePoint[] {
  const out: FlatKnowledgePoint[] = [];
  const walk = (point: KnowledgePoint, parentId: string | null, depth: number) => {
    out.push({ point, parentId, depth });
    for (const child of point.children) walk(child, point.id, depth + 1);
  };
  walk(root, null, 0);
  return out;
}

export function countKnowledgePoints(root: KnowledgePoint): number {
  return flattenKnowledge(root).length;
}
