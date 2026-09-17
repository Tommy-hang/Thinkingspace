// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { ModelPrice, UsageCostKind } from '../types';

/**
 * 模型价格层 —— 单价只在这里出现，**绝不散落到聊天组件里**。
 *
 * ⚠️ 说明：
 * - 下面是一份**参考价**（单位：美元 / 每 100 万 token），各家官方会随时调整；
 * - 用户可在「设置 → 行为与用量 → 自定义模型价格」里覆盖；
 * - 表里没有的模型一律视为「价格未知」，**不会**猜测、也不会当成 0。
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // DeepSeek
  'deepseek-flash': { input: 0.28, output: 0.42, cachedInput: 0.028 },
  'deepseek-v4-flash': { input: 0.28, output: 0.42, cachedInput: 0.028 },
  'deepseek-v4-pro': { input: 0.55, output: 2.19, cachedInput: 0.055 },
  'deepseek-chat': { input: 0.28, output: 0.42, cachedInput: 0.028 },
  'deepseek-reasoner': { input: 0.28, output: 0.42, cachedInput: 0.028 },

  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
  'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
  'o4-mini': { input: 1.1, output: 4.4, cachedInput: 0.275 },

  // OpenRouter 常见模型
  'anthropic/claude-sonnet-4': { input: 3, output: 15, cachedInput: 0.3 },
  'google/gemini-2.0-flash-001': { input: 0.1, output: 0.4 },
};

export interface CostInput {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export interface CostResult {
  kind: UsageCostKind;
  /** 美元；kind 为 unavailable 时为 undefined */
  usd?: number;
}

export function resolvePrice(
  model: string,
  customPrices?: Record<string, ModelPrice>,
): ModelPrice | null {
  const custom = customPrices?.[model];
  if (custom && typeof custom.input === 'number' && typeof custom.output === 'number') {
    return custom;
  }
  return MODEL_PRICES[model] ?? null;
}

/**
 * 由 token 数推算费用。
 *
 * 约定：
 * - `inputTokens` 若包含缓存命中的部分，会按 `cachedInput` 单价折算（不重复计费）；
 * - `reasoningTokens` 视为已包含在 `outputTokens` 内（多数 Provider 如此），
 *   因此**不额外加价**，只在明细里展示；
 * - 找不到价格时返回 `unavailable`，绝不返回 0 冒充免费。
 */
export function estimateCost(
  model: string,
  usage: CostInput,
  options: { customPrices?: Record<string, ModelPrice>; isLocal?: boolean } = {},
): CostResult {
  if (options.isLocal) return { kind: 'free', usd: 0 };

  const price = resolvePrice(model, options.customPrices);
  if (!price) return { kind: 'unavailable' };

  const input = Math.max(0, usage.inputTokens ?? 0);
  const cached = Math.min(Math.max(0, usage.cachedInputTokens ?? 0), input);
  const output = Math.max(0, usage.outputTokens ?? 0);

  const cachedPrice = price.cachedInput ?? price.input;

  const usd =
    ((input - cached) * price.input + cached * cachedPrice + output * price.output) /
    1_000_000;

  return { kind: 'estimated', usd: Math.max(0, usd) };
}
