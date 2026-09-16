// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

/**
 * 把模型常用的 LaTeX 分隔符转换成 remark-math 认识的 `$` / `$$` 形式。
 *
 * 背景：不少模型输出 `\[ ... \]`（独立公式）和 `\( ... \)`（行内公式），
 * 但 Markdown 会把 `\[`、`\(` 当成**转义**、把反斜杠吃掉，
 * 于是公式退化成普通文字，看起来像 `[ h_t = ... ]` 和 `(h_t)`，完全无法渲染。
 *
 * 处理时会先跳过代码块与行内代码，避免误伤。
 */
export function normalizeMathDelimiters(input: string): string {
  if (!input) return input;

  const code: string[] = [];
  const masked = input.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, (match) => {
    code.push(match);
    return `\u0000${code.length - 1}\u0000`;
  });

  const converted = masked
    // \[ ... \] → 独立公式
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `\n$$\n${body.trim()}\n$$\n`)
    // \( ... \) → 行内公式
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$${body.trim()}$`);

  return converted.replace(/\u0000(\d+)\u0000/g, (_m, index: string) => code[Number(index)] ?? '');
}
