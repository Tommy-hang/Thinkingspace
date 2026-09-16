// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

/** 从模型输出里尽力取出 JSON（兼容 ```json 代码块和前后废话） */
export function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/```[a-zA-Z]*/g, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* 继续尝试截取 */
  }
  const pairs: [number, number][] = [
    [cleaned.indexOf('{'), cleaned.lastIndexOf('}')],
    [cleaned.indexOf('['), cleaned.lastIndexOf(']')],
  ];
  for (const [start, end] of pairs) {
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* 继续 */
      }
    }
  }
  return null;
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
