// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useState } from 'react';
import { useStore } from '../store/store';
import { IconPlus } from './icons';

export function EmptyState() {
  const createProject = useStore((s) => s.createProject);
  const [title, setTitle] = useState('');

  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="ts-fade-up w-full max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          TS
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight">开始你的第一个思维空间</h1>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          一个项目 = 一个思考空间。把 AI 对话从一条时间线，变成一张可以探索的地图。
        </p>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="给项目起个名字，例如：Transformer 学习"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createProject(title);
            }}
          />
          <button className="btn btn-primary shrink-0" onClick={() => createProject(title)}>
            <IconPlus width={15} height={15} />
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
