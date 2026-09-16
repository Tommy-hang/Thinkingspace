// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

export interface DiffPart {
  type: 'same' | 'add' | 'remove';
  text: string;
}

/** 把一段文字切成句子（保留句末标点），用于句子级差异比较 */
function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.match(/[^。！？；!?;]+[。！？；!?;]?/g) ?? [clean];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/**
 * 句子级差异（LCS）。
 * 用于「当前理解」更新前展示 + 新增 / − 删除，让用户确认后再成为新版本。
 */
export function diffSentences(oldText: string, newText: string): DiffPart[] {
  const a = splitSentences(oldText);
  const b = splitSentences(newText);

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'remove', text: a[i] });
      i += 1;
    } else {
      out.push({ type: 'add', text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    out.push({ type: 'remove', text: a[i] });
    i += 1;
  }
  while (j < n) {
    out.push({ type: 'add', text: b[j] });
    j += 1;
  }

  return out;
}

export function diffSummary(parts: DiffPart[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    if (p.type === 'add') added += 1;
    else if (p.type === 'remove') removed += 1;
  }
  return { added, removed };
}
