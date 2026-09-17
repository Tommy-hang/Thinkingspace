// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { AiUsage, Message, ModelPrice, UsageCostKind } from '../../types';
import { estimateCost } from '../pricing';

/**
 * AI 用量归一化层。
 *
 * 分层原则（很重要）：
 *   Provider Adapter  → 把各家原始 JSON 解析成 `RawUsage`（只有 token 数）
 *   normalizeUsage()  → 补上 provider / model / 价格 / 延迟，得到统一的 `AiUsage`
 *   聊天 UI           → 只认 `AiUsage`，永远不接触任何 Provider 的原始字段
 */

/** 与厂商无关的原始用量 */
export interface RawUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  /** 若 Provider 直接给出金额（美元），优先使用 */
  costUsd?: number;
}

export interface NormalizeUsageInput {
  providerId: string;
  provider: string;
  model: string;
  raw?: RawUsage;
  latencyMs?: number;
  /** 本地模型 / 离线演示：明确算「免费」，不与「价格未知」混淆 */
  isLocal?: boolean;
  customPrices?: Record<string, ModelPrice>;
}

export function normalizeUsage(input: NormalizeUsageInput): AiUsage {
  const raw = input.raw;

  const inputTokens = num(raw?.promptTokens);
  const outputTokens = num(raw?.completionTokens);
  const reasoningTokens = num(raw?.reasoningTokens);
  const cachedInputTokens = num(raw?.cachedTokens);
  const totalTokens =
    num(raw?.totalTokens) ??
    (inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);

  let costKind: UsageCostKind = 'unavailable';
  let costUsd: number | undefined;

  if (input.isLocal) {
    costKind = 'free';
    costUsd = 0;
  } else if (typeof raw?.costUsd === 'number') {
    costKind = 'exact';
    costUsd = raw.costUsd;
  } else if (inputTokens !== undefined || outputTokens !== undefined) {
    const est = estimateCost(
      input.model,
      { inputTokens, outputTokens, cachedInputTokens },
      { customPrices: input.customPrices },
    );
    costKind = est.kind;
    costUsd = est.usd;
  }

  return {
    providerId: input.providerId,
    provider: input.provider,
    model: input.model,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedInputTokens,
    totalTokens,
    costKind,
    costUsd,
    latencyMs: input.latencyMs,
    at: Date.now(),
  };
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/* ============================ 展示 ============================ */

export function formatTokens(n?: number): string {
  if (n === undefined) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 100 ? k.toFixed(1) : Math.round(k)}K`;
  }
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatUsd(usd?: number): string {
  if (usd === undefined) return '—';
  if (usd === 0) return '0';
  if (usd < 0.01) return usd.toFixed(4);
  if (usd < 1) return usd.toFixed(3);
  return usd.toFixed(2);
}

/** 单次调用的费用文案；明确区分 精确 / 估算 / 免费 / 未知 */
export function formatCost(usage: AiUsage): string {
  switch (usage.costKind) {
    case 'free':
      return '免费';
    case 'unavailable':
      return '价格未知';
    case 'exact':
      return `$${formatUsd(usage.costUsd)}`;
    case 'estimated':
    default:
      return `≈$${formatUsd(usage.costUsd)}`;
  }
}

/* ============================ 累积 ============================ */

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  costUsd: number;
  /** 有调用拿不到价格 → 总费用只是下界 */
  hasUnpriced: boolean;
  /** 有调用是估算价 */
  hasEstimated: boolean;
  /** 有调用是精确价 */
  hasExact: boolean;
}

export function sumUsage(messages: Pick<Message, 'usage'>[]): UsageTotals {
  const totals: UsageTotals = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    hasUnpriced: false,
    hasEstimated: false,
    hasExact: false,
  };

  for (const m of messages) {
    const u = m.usage;
    if (!u) continue;
    totals.calls += 1;
    totals.inputTokens += u.inputTokens ?? 0;
    totals.outputTokens += u.outputTokens ?? 0;
    totals.reasoningTokens += u.reasoningTokens ?? 0;
    totals.cachedInputTokens += u.cachedInputTokens ?? 0;
    totals.totalTokens += u.totalTokens ?? 0;

    if (u.costKind === 'unavailable') totals.hasUnpriced = true;
    if (u.costKind === 'estimated') totals.hasEstimated = true;
    if (u.costKind === 'exact') totals.hasExact = true;
    totals.costUsd += u.costUsd ?? 0;
  }

  return totals;
}

/** 会话累计费用文案：有未知价格时用 ≥ 表示这只是下界 */
export function formatTotalsCost(totals: UsageTotals): string {
  if (totals.calls === 0) return '—';
  if (totals.hasUnpriced && totals.costUsd === 0 && !totals.hasEstimated && !totals.hasExact) {
    return '价格未知';
  }
  const prefix = totals.hasUnpriced ? '≥' : totals.hasEstimated ? '≈' : '';
  return `${prefix}$${formatUsd(totals.costUsd)}`;
}

/** 会话累计摘要：`42.6K tokens · ≈$0.083` */
export function formatTotalsSummary(totals: UsageTotals): string {
  if (totals.calls === 0) return '';
  return `${formatTokens(totals.totalTokens)} tokens · ${formatTotalsCost(totals)}`;
}
