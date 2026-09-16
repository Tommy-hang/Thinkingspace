// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useStore } from '../store/store';
import { IconCloud, IconX } from './icons';

/**
 * 检测到同步冲突时的醒目提示。
 * 冲突意味着两台设备改了同一份内容——我们不会覆盖任何一边，
 * 而是把另一份另存为一个新项目（见 cloud/engine.ts）。
 */
export function SyncConflictBanner() {
  const conflicts = useStore((s) => s.syncConflicts);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const dismiss = useStore((s) => s.dismissConflicts);

  if (conflicts.length === 0) return null;

  return (
    <div
      className="ts-banner flex shrink-0 items-center gap-2 px-3 py-1.5 text-[11.5px] md:h-[30px] md:py-0"
      style={{
        background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
        color: 'var(--muted)',
        borderBottom: '1px solid color-mix(in srgb, #f59e0b 40%, transparent)',
      }}
    >
      <span className="shrink-0" style={{ color: '#b45309' }}>
        <IconCloud width={13} height={13} />
      </span>
      <span className="truncate">
        <strong style={{ color: '#b45309' }}>检测到同步冲突</strong>
        ：两台设备改过同一份内容，已自动保留两份，
        <strong>没有丢失任何数据</strong>。
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          className="btn btn-ghost !px-2 !py-0 !text-[11.5px]"
          style={{ color: '#b45309' }}
          onClick={() => setAuthOpen(true)}
        >
          查看详情
        </button>
        <button
          className="btn btn-ghost !px-1.5 !py-0"
          style={{ color: 'var(--faint)' }}
          title="知道了"
          onClick={dismiss}
        >
          <IconX width={12} height={12} />
        </button>
      </div>
    </div>
  );
}
