// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useState } from 'react';
import type { ContextManifest } from '../types';
import { IconLens } from './icons';

/**
 * 上下文透镜：把「这次回答 AI 实际用了哪些内容」展示出来。
 *
 * 用户看不到完整 Prompt，但能确认 AI 为什么理解了这些内容——
 * 这也是 ThinkingSpace 与普通聊天产品最根本的差异所在。
 */
export function ContextLens({ manifest }: { manifest: ContextManifest }) {
  const [open, setOpen] = useState(false);
  const used = manifest.parts.length;

  return (
    <div
      className="mt-1.5 overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--border)', background: 'var(--panel-2)' }}
    >
      <button
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11.5px]"
        style={{ color: 'var(--muted)' }}
        onClick={() => setOpen((o) => !o)}
        title="查看这次回答使用了哪些上下文"
      >
        <IconLens width={12} height={12} />
        <span>上下文透镜</span>
        <span style={{ color: 'var(--faint)' }}>· 本次使用了 {used} 部分</span>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--faint)' }}>
          {open ? '收起' : '展开'}
        </span>
      </button>

      {open && (
        <div
          className="flex flex-col gap-1 px-2.5 pb-2.5 pt-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {manifest.parts.map((p, i) => (
            <div key={`${p.kind}-${i}`} className="flex items-start gap-1.5 text-[11.5px]">
              <span className="shrink-0" style={{ color: '#16a34a' }}>
                ✓
              </span>
              <span className="shrink-0" style={{ color: 'var(--text)' }}>
                {p.label}
              </span>
              {p.detail && (
                <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--faint)' }}>
                  {p.detail}
                </span>
              )}
            </div>
          ))}

          {manifest.excludedTopics > 0 && (
            <div className="flex items-start gap-1.5 text-[11.5px]">
              <span className="shrink-0" style={{ color: 'var(--faint)' }}>
                ×
              </span>
              <span style={{ color: 'var(--faint)' }}>
                其他 {manifest.excludedTopics} 个无关主题未加入
              </span>
            </div>
          )}

          <div
            className="pt-1 text-[10.5px] leading-relaxed"
            style={{ color: 'var(--faint)', borderTop: '1px solid var(--border)', marginTop: 2 }}
          >
            约 {manifest.totalChars} 字。只发送与当前主题相关的内容，不发送全部历史——
            你看到的结构，就是 AI 看到的记忆结构。
          </div>
        </div>
      )}
    </div>
  );
}
