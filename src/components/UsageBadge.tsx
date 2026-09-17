// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useState } from 'react';
import type { AiUsage } from '../types';
import { formatCost, formatTokens } from '../lib/ai/usage';
import { IconUsage } from './icons';

/**
 * 单次回答的用量：**默认只显示一行极轻量的信息**，
 * 需要时才展开明细——属于辅助信息，不抢回答正文的注意力。
 */
export function UsageBadge({ usage }: { usage: AiUsage }) {
  const [open, setOpen] = useState(false);

  const cost = formatCost(usage);
  const compact =
    usage.totalTokens === undefined ? cost : `${formatTokens(usage.totalTokens)} tokens · ${cost}`;

  return (
    <div className="mt-1.5">
      <button
        className="flex items-center gap-1.5 text-[11px]"
        style={{ color: 'var(--faint)' }}
        onClick={() => setOpen((o) => !o)}
        title="查看这次调用的用量明细"
      >
        <IconUsage width={11} height={11} />
        <span>{compact}</span>
        <span style={{ opacity: 0.65 }}>{open ? '收起' : '明细'}</span>
      </button>

      {open && (
        <div
          className="mt-1.5 grid grid-cols-2 gap-x-5 gap-y-1 rounded-lg px-3 py-2.5 text-[11.5px]"
          style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
        >
          <Row label="输入 tokens" value={fmt(usage.inputTokens)} />
          <Row label="输出 tokens" value={fmt(usage.outputTokens)} />
          <Row label="推理 tokens" value={fmt(usage.reasoningTokens)} />
          <Row label="缓存命中" value={fmt(usage.cachedInputTokens)} />
          <Row label="合计 tokens" value={fmt(usage.totalTokens)} />
          <Row label="费用" value={cost} />
          <Row label="模型" value={usage.model} />
          <Row label="服务商" value={usage.provider} />
          <Row
            label="耗时"
            value={usage.latencyMs === undefined ? '—' : `${(usage.latencyMs / 1000).toFixed(1)}s`}
          />
        </div>
      )}
    </div>
  );
}

function fmt(n?: number): string {
  return n === undefined ? '—' : String(n);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span style={{ color: 'var(--faint)' }}>{label}</span>
      <span className="truncate" style={{ color: 'var(--muted)' }} title={value}>
        {value}
      </span>
    </div>
  );
}
