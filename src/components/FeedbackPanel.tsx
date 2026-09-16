// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { copyText } from '../lib/link';
import { APP_VERSION } from '../version';
import { IconCheck, IconInfo } from './icons';

const REPO_ISSUES = 'https://github.com/Tommy-hang/Thinkingspace/issues/new';

export function FeedbackPanel() {
  const open = useStore((s) => s.feedbackOpen);
  const setOpen = useStore((s) => s.setFeedbackOpen);
  const projects = useStore((s) => s.projects);
  const nodes = useStore((s) => s.nodes);
  const messages = useStore((s) => s.messages);
  const settings = useStore((s) => s.settings);
  const secrets = useStore((s) => s.secrets);
  const cloudUser = useStore((s) => s.cloudUser);
  const cloudStatus = useStore((s) => s.cloudStatus);
  const recentErrors = useStore((s) => s.recentErrors);
  const clearErrors = useStore((s) => s.clearErrors);

  const [detail, setDetail] = useState('');
  const [copied, setCopied] = useState(false);

  const provider = settings.providers.find((p) => p.id === settings.activeProviderId);

  const diagnostics = useMemo(() => {
    const lines = [
      '【ThinkingSpace 诊断信息】',
      `版本：${APP_VERSION}`,
      `时间：${new Date().toLocaleString('zh-CN')}`,
      `浏览器：${typeof navigator !== 'undefined' ? navigator.userAgent : '未知'}`,
      `屏幕：${typeof window !== 'undefined' ? `${window.innerWidth} × ${window.innerHeight}` : '未知'}`,
      `项目数：${projects.length}`,
      `主题数：${nodes.length}`,
      `对话数：${messages.length}`,
      `当前模型：${provider ? `${provider.displayName} · ${provider.model}` : '未配置'}`,
      `深度思考：${settings.thinking.enabled ? `开（${settings.thinking.effort}）` : '关'}`,
      `联网搜索：${settings.search.enabled ? '开' : '关'}`,
      `API Key：${provider && secrets[provider.id] ? '已配置' : '未配置'}`,
      `云端：${
        cloudStatus === 'disabled'
          ? '未启用'
          : cloudUser
            ? `已登录（${cloudUser.email}）· ${cloudStatus}`
            : `未登录 · ${cloudStatus}`
      }`,
    ];

    if (recentErrors.length > 0) {
      lines.push('最近错误：');
      recentErrors.forEach((e) => {
        lines.push(`  - [${e.scope}] ${e.message}`);
      });
    } else {
      lines.push('最近错误：无');
    }

    return lines.join('\n');
  }, [
    projects.length,
    nodes.length,
    messages.length,
    provider,
    settings.thinking,
    settings.search.enabled,
    secrets,
    cloudStatus,
    cloudUser,
    recentErrors,
  ]);

  const copyAll = async () => {
    const text = detail.trim()
      ? `${detail.trim()}\n\n${diagnostics}`
      : diagnostics;
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  const openIssue = () => {
    const body = [
      '### 我遇到的问题',
      detail.trim() || '（请在这里描述）',
      '',
      '### 诊断信息',
      '```',
      diagnostics,
      '```',
    ].join('\n');
    const url = `${REPO_ISSUES}?title=${encodeURIComponent(
      '反馈：',
    )}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  };

  return (
    <Modal open={open} title="反馈问题" onClose={() => setOpen(false)} width={640}>
      <div
        className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed"
        style={{
          background: 'var(--accent-soft)',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          color: 'var(--text)',
        }}
      >
        <span className="mt-[2px] shrink-0" style={{ color: 'var(--accent)' }}>
          <IconInfo width={14} height={14} />
        </span>
        <span>
          遇到问题、想提建议，或者发现哪里不好用，都可以在这里反馈。
          <br />
          「诊断信息」能帮维护者快速定位问题，<strong>不包含你的对话内容</strong>。
        </span>
      </div>

      <label className="mb-1 block text-[12px]" style={{ color: 'var(--muted)' }}>
        描述一下你遇到的问题（可选）
      </label>
      <textarea
        className="input ts-scroll mb-4 resize-none"
        rows={4}
        placeholder="例如：我在手机上点开侧栏后，点了主题没有反应……"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
          诊断信息
        </span>
        {recentErrors.length > 0 && (
          <button
            className="btn btn-ghost !px-2 !py-0.5 !text-[11.5px]"
            onClick={clearErrors}
          >
            清空错误记录
          </button>
        )}
      </div>

      <pre
        className="ts-scroll mb-4 max-h-56 overflow-auto rounded-xl px-3.5 py-3 text-[11px] leading-relaxed"
        style={{
          background: 'var(--panel-2)',
          border: '1px solid var(--border)',
          color: 'var(--muted)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {diagnostics}
      </pre>

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn btn-outline" onClick={() => void copyAll()}>
          {copied ? <IconCheck width={14} height={14} /> : null}
          {copied ? '已复制' : '复制诊断信息'}
        </button>
        <button className="btn btn-primary" onClick={openIssue}>
          在 GitHub 上提交 Issue
        </button>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
        没有 GitHub 账号也没关系——点「复制诊断信息」，把内容发给站点维护者即可。
      </p>
    </Modal>
  );
}
