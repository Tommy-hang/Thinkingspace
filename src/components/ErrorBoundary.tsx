// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误边界。
 *
 * React 里只要有一个组件在渲染时抛错，整棵树都会被卸载 —— 表现就是**整页白屏**。
 * 有了它，至少能把错误显示出来、并让用户刷新，而不是对着白屏不知所措。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ThinkingSpace] 界面渲染出错：', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-[15px] font-semibold">界面出了点问题</h2>
        <p className="max-w-[440px] text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          你的数据保存在本地，<strong>不会因此丢失</strong>。
          先刷新页面通常就能恢复；如果反复出现，请把下面的信息反馈给作者。
        </p>
        <pre
          className="ts-scroll max-h-[180px] max-w-[560px] overflow-auto rounded-lg p-3 text-left text-[11px] leading-relaxed"
          style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {String(error.stack || error.message || error)}
        </pre>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={() => this.setState({ error: null })}>
            返回
          </button>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}
