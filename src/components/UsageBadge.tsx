// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useState } from 'react';
import type { AiUsage, RequestPlan } from '../types';
import {
  formatCacheRate,
  formatCost,
  formatSavings,
  formatTokens,
  optimizationRate,
} from '../lib/ai/usage';
import { IconUsage } from './icons';

const REASONING_LABEL: Record<string, string> = {
  none: '关',
  low: '低',
  high: '高',
  max: '最高',
};

const BUDGET_LABEL: Record<string, string> = {
  compact: '简短',
  normal: '普通',
  detailed: '展开',
  deep: '深入',
};

/**
 * 单次回答的成本 / 效率信息。
 *
 * 默认**只显示一行**（tokens · 费用 · 省了多少），需要时才展开明细 ——
 * 属于辅助信息，不抢回答正文的注意力。
 */
export function UsageBadge({ usage, plan }: { usage: AiUsage; plan?: RequestPlan }) {
  const [open, setOpen] = useState(false);

  const cost = formatCost(usage);
  const rate = optimizationRate(usage);
  const tokens = usage.totalTokens;

  const compact = [
    tokens === undefined ? null : `${formatTokens(tokens)} tokens`,
    cost,
    rate === null ? null : `省 ${Math.round(rate * 100)}%`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mt-1.5">
      <button
        className="flex items-center gap-1.5 text-[11px]"
        style={{ color: 'var(--faint)' }}
        onClick={() => setOpen((o) => !o)}
        title="查看这次调用的成本与决策明细"
      >
        <IconUsage width={11} height={11} />
        <span>{compact}</span>
        <span style={{ opacity: 0.65 }}>{open ? '收起' : '明细'}</span>
      </button>

      {open && (
        <div
          className="mt-1.5 rounded-lg px-3 py-2.5"
          style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[11.5px]">
            <Row label="输入 tokens" value={fmt(usage.inputTokens)} />
            <Row label="其中命中缓存" value={fmt(usage.cachedInputTokens)} />
            <Row label="未命中缓存" value={fmt(usage.uncachedInputTokens)} />
            <Row label="缓存命中率" value={formatCacheRate(usage) ?? '—'} />
            <Row label="推理 tokens" value={fmt(usage.reasoningTokens)} />
            <Row label="输出 tokens" value={fmt(usage.outputTokens)} />
            <Row label="合计 tokens" value={fmt(usage.totalTokens)} />
            <Row label="实际费用" value={cost} />
            <Row label="若无缓存" value={baselineText(usage)} />
            <Row label="缓存省下" value={formatSavings(usage) ?? '—'} />
            <Row label="模型" value={usage.model} />
            <Row label="服务商" value={usage.provider} />
            <Row
              label="耗时"
              value={
                usage.latencyMs === undefined ? '—' : `${(usage.latencyMs / 1000).toFixed(1)}s`
              }
            />
          </div>

          {plan && (
            <div
              className="mt-2 grid grid-cols-1 gap-x-5 gap-y-1 pt-2 text-[11.5px]"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <Row
                label="思考强度"
                value={`${REASONING_LABEL[plan.reasoning] ?? plan.reasoning} · ${plan.reasoningWhy}`}
              />
              <Row
                label="回答长度"
                value={`${BUDGET_LABEL[plan.outputBudget] ?? plan.outputBudget} · ${plan.outputWhy}`}
              />
              <Row
                label="稳定前缀"
                value={`${plan.stableChars} 字 · 指纹 ${plan.prefixFingerprint}`}
              />
              <Row label="动态上下文" value={`${plan.dynamicChars} 字`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function baselineText(usage: AiUsage): string {
  if (usage.baselineInputCost === undefined || usage.costUsd === undefined) return '—';
  const baseline = usage.costUsd + (usage.cacheSavingsUsd ?? 0);
  return `≈$${baseline.toFixed(4)}`;
}

function fmt(n?: number): string {
  return n === undefined ? '—' : String(n);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <span className="shrink-0" style={{ color: 'var(--faint)' }}>
        {label}
      </span>
      <span className="min-w-0 text-right" style={{ color: 'var(--muted)' }} title={value}>
        {value}
      </span>
    </div>
  );
}
