// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type {
  BehaviorDimensionKey,
  BehaviorDimensions,
  BehaviorProfile,
} from '../types';

/**
 * Behavior Profile —— 控制模型「如何思考」，而不是「说什么语言」。
 *
 * 设计要点：
 * - Profile = 一组**行为维度**（0~4）+ 用户自由说明；
 * - 提示词由维度**声明式**生成，因此以后增加维度只需在这里加一项，
 *   不需要改动 store / UI / Provider 任何地方；
 * - 预留 `compute`（Quick / Balanced / Deep），本版本只存不用。
 */

export interface BehaviorDimensionDef {
  key: BehaviorDimensionKey;
  /** 界面上的维度名 */
  label: string;
  /** 左端（0）的含义 */
  low: string;
  /** 右端（4）的含义 */
  high: string;
  /** 0~4 → 一句行为指导；返回 null 表示「中间值，不必额外说明」 */
  describe: (value: number) => string | null;
}

export const BEHAVIOR_DIMENSIONS: BehaviorDimensionDef[] = [
  {
    key: 'focus',
    label: '思考范围',
    low: '聚焦',
    high: '发散',
    describe: (v) =>
      v <= 1
        ? '紧扣问题本身作答，不要引入题外话题或额外延伸。'
        : v >= 3
          ? '在回答主问题的同时，主动指出相邻的、值得进一步探索的方向。'
          : null,
  },
  {
    key: 'length',
    label: '回答长度',
    low: '简洁',
    high: '详尽',
    describe: (v) =>
      v <= 1
        ? '尽量简短，只保留必要信息；一两句能说清就不要展开。'
        : v >= 3
          ? '把背景、推导与边界情况讲透，不要因为怕长而省略关键内容。'
          : null,
  },
  {
    key: 'risk',
    label: '结论取向',
    low: '保守',
    high: '创意',
    describe: (v) =>
      v <= 1
        ? '只陈述有把握、有共识的内容；不确定的地方要明确标注，不要给出未经证实的猜测。'
        : v >= 3
          ? '鼓励提出非常规的思路与类比，即使还不成熟也可以提出来讨论，但要标注哪些属于推测。'
          : null,
  },
  {
    key: 'stance',
    label: '立场',
    low: '支持',
    high: '批判',
    describe: (v) =>
      v <= 1
        ? '以帮助用户理解与推进为主，语气支持性；先把问题讲清楚，再谈可能的不足。'
        : v >= 3
          ? '主动质疑前提与结论，指出漏洞、反例以及不成立的条件，不要一味附和。'
          : null,
  },
  {
    key: 'form',
    label: '组织形式',
    low: '自由',
    high: '结构化',
    describe: (v) =>
      v <= 1
        ? '用连贯的段落表达，像讲解一样自然展开，不要强行分点。'
        : v >= 3
          ? '用清晰的结构组织：先给结论，再分层展开，必要时使用列表或小标题。'
          : null,
  },
];

export const BEHAVIOR_DIMENSION_MID = 2;
export const BEHAVIOR_DIMENSION_MIN = 0;
export const BEHAVIOR_DIMENSION_MAX = 4;

function dims(
  focus: number,
  length: number,
  risk: number,
  stance: number,
  form: number,
): BehaviorDimensions {
  return { focus, length, risk, stance, form };
}

/** 内置 Profile：id 稳定，维度随版本调整时以代码为准 */
export const DEFAULT_BEHAVIOR_PROFILES: BehaviorProfile[] = [
  {
    id: 'default',
    name: '默认',
    hint: '平衡、克制，不额外干预',
    builtin: true,
    dimensions: dims(2, 2, 2, 2, 2),
  },
  {
    id: 'explorer',
    name: '探索者',
    hint: '广泛联想，帮你找新方向',
    builtin: true,
    dimensions: dims(4, 3, 4, 2, 1),
  },
  {
    id: 'engineer',
    name: '工程师',
    hint: '务实、可落地、重细节',
    builtin: true,
    dimensions: dims(1, 2, 1, 3, 4),
  },
  {
    id: 'scholar',
    name: '学者',
    hint: '严谨、讲清前提与依据',
    builtin: true,
    dimensions: dims(1, 4, 1, 3, 4),
  },
  {
    id: 'critic',
    name: '批判者',
    hint: '质疑前提，找漏洞与反例',
    builtin: true,
    dimensions: dims(2, 2, 2, 4, 3),
  },
  {
    id: 'teacher',
    name: '老师',
    hint: '循序渐进，用类比讲明白',
    builtin: true,
    dimensions: dims(2, 3, 1, 1, 3),
  },
  {
    id: 'creator',
    name: '创作者',
    hint: '头脑风暴，产出多种可能',
    builtin: true,
    dimensions: dims(4, 2, 4, 1, 1),
  },
];

export const DEFAULT_BEHAVIOR_ID = 'default';

/** 从 Profile 生成一段系统提示词；「默认」这类全中性的 Profile 返回空串 */
export function buildBehaviorPrompt(profile: BehaviorProfile): string {
  const guidance = BEHAVIOR_DIMENSIONS.map((d) =>
    d.describe(profile.dimensions[d.key] ?? BEHAVIOR_DIMENSION_MID),
  ).filter((x): x is string => Boolean(x));

  const extra = profile.instructions?.trim();

  if (guidance.length === 0 && !extra) return '';

  const lines = [`【本次回答的行为倾向：${profile.name}】`];
  lines.push(...guidance.map((g, i) => `${i + 1}. ${g}`));
  if (extra) lines.push(`补充要求：${extra}`);
  lines.push('以上只影响回答方式，不要因此偏离用户的真实问题。');
  return lines.join('\n');
}

/** 按 id 找 Profile，找不到就回退到默认。**对空/缺失的 profiles 也安全**。 */
export function findBehavior(
  profiles: BehaviorProfile[] | undefined,
  id: string | undefined,
): BehaviorProfile {
  const list = profiles && profiles.length > 0 ? profiles : DEFAULT_BEHAVIOR_PROFILES;
  if (id) {
    const hit = list.find((p) => p.id === id);
    if (hit) return hit;
  }
  return (
    list.find((p) => p.id === DEFAULT_BEHAVIOR_ID) ??
    list[0] ??
    DEFAULT_BEHAVIOR_PROFILES[0]
  );
}

/**
 * 三级作用域解析：Message Override → Conversation → Global → System Default
 * 这里只负责「选出 id」，具体 Profile 由 findBehavior 解析。
 */
export function resolveBehaviorId(
  globalId: string | undefined,
  conversationId: string | undefined,
  messageOverrideId: string | undefined,
): string {
  return messageOverrideId || conversationId || globalId || DEFAULT_BEHAVIOR_ID;
}

/** 读取旧数据时，把内置 Profile 与用户自定义的合并（内置以代码为准） */
export function mergeBehaviorProfiles(saved?: BehaviorProfile[]): BehaviorProfile[] {
  if (!saved || saved.length === 0) return DEFAULT_BEHAVIOR_PROFILES;
  const custom = saved.filter(
    (p) => !DEFAULT_BEHAVIOR_PROFILES.some((d) => d.id === p.id),
  );
  return [...DEFAULT_BEHAVIOR_PROFILES, ...custom];
}

/** 维度数值 → 0~1 的归一化比例（给滑块用） */
export function dimensionRatio(value: number): number {
  return (
    (value - BEHAVIOR_DIMENSION_MIN) / (BEHAVIOR_DIMENSION_MAX - BEHAVIOR_DIMENSION_MIN)
  );
}
