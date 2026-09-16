// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

/**
 * 在不超过 max 个字的前提下，尽量截到「句子边界」，避免出现语义不完整的半截话。
 *
 * 优先在句末标点（。！？；…）处收尾——这样截出来的仍然是一句完整的话；
 * 找不到句末标点就退到逗号/顿号；再找不到才硬截（此时才补省略号）。
 */
export function clipAtSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const window = clean.slice(0, max);

  for (let i = window.length - 1; i >= 0; i -= 1) {
    if (/[。！？!?；;…]/.test(window[i])) return window.slice(0, i + 1);
  }

  for (let i = window.length - 1; i >= 0; i -= 1) {
    if (/[，,、]/.test(window[i])) return `${window.slice(0, i + 1)}…`;
  }

  return `${window}…`;
}
