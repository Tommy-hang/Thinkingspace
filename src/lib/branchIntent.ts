// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { BranchIntent, EdgeType } from '../types';

export interface IntentMeta {
  label: string;
  hint: string;
  /** 选择该意图后自动生成的初始问题模板 */
  build: (anchor: string) => string;
  edge: EdgeType;
}

export const INTENT_META: Record<BranchIntent, IntentMeta> = {
  branch: {
    label: '继续探索',
    hint: '沿着这个方向继续',
    build: (a) => `请继续深入这个方向：\n\n「${a}」`,
    edge: 'branch',
  },
  explore: {
    label: '深入解释',
    hint: '把这句话讲透',
    build: (a) => `请深入解释这段话的含义、背景和细节：\n\n「${a}」`,
    edge: 'branch',
  },
  why: {
    label: '为什么',
    hint: '追问原因与机制',
    build: (a) => `为什么是这样？请解释它背后的原因和机制：\n\n「${a}」`,
    edge: 'dependency',
  },
  example: {
    label: '举例',
    hint: '用一个实例说明',
    build: (a) => `请给出一个具体、可验证的例子来说明：\n\n「${a}」`,
    edge: 'example',
  },
  counterexample: {
    label: '反例',
    hint: '找局限与不成立的情况',
    build: (a) =>
      `这个说法有哪些反例、局限或不成立的情况？请具体指出，并说明在什么条件下它会失效：\n\n「${a}」`,
    edge: 'contrast',
  },
  connection: {
    label: '建立联系',
    hint: '与其他概念的关系',
    build: (a) => `这段内容和哪些其他概念有关系？请说明它们之间的联系与区别：\n\n「${a}」`,
    edge: 'reference',
  },
  custom: {
    label: '自定义问题',
    hint: '自己写问题',
    build: (a) => `关于「${a}」：`,
    edge: 'branch',
  },
};

export const INTENT_ORDER: BranchIntent[] = [
  'explore',
  'why',
  'example',
  'counterexample',
  'connection',
  'custom',
];

export function intentToEdgeType(intent: BranchIntent): EdgeType {
  return INTENT_META[intent]?.edge ?? 'branch';
}

export function intentLabel(intent?: BranchIntent): string | null {
  if (!intent || intent === 'branch') return null;
  return INTENT_META[intent]?.label ?? null;
}

export function buildIntentQuestion(intent: BranchIntent, anchorText: string): string {
  return INTENT_META[intent].build(anchorText);
}
