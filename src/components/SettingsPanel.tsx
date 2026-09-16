// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useState } from 'react';
import { useStore } from '../store/store';
import type { ThinkingEffort } from '../types';
import { Modal } from './Modal';
import { IconKey, IconPlus, IconTrash } from './icons';

export function SettingsPanel() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const settings = useStore((s) => s.settings);
  const secrets = useStore((s) => s.secrets);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateContext = useStore((s) => s.updateContextSettings);
  const updateProvider = useStore((s) => s.updateProvider);
  const addProvider = useStore((s) => s.addProvider);
  const removeProvider = useStore((s) => s.removeProvider);
  const setActiveProvider = useStore((s) => s.setActiveProvider);
  const setSecret = useStore((s) => s.setSecret);
  const setThinking = useStore((s) => s.setThinking);
  const setSearchEnabled = useStore((s) => s.setSearchEnabled);
  const setActiveSearchProvider = useStore((s) => s.setActiveSearchProvider);
  const setSearchMaxResults = useStore((s) => s.setSearchMaxResults);
  const setPrivacyOpen = useStore((s) => s.setPrivacyOpen);
  const setApiKeyGuideOpen = useStore((s) => s.setApiKeyGuideOpen);
  const setFeedbackOpen = useStore((s) => s.setFeedbackOpen);
  const resetToSample = useStore((s) => s.resetToSample);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', baseUrl: '', model: '' });

  return (
    <Modal open={open} title="设置" onClose={() => setOpen(false)} width={640}>
      <section className="mb-6">
        <h3 className="mb-2 text-[13px] font-semibold">外观</h3>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              className="btn"
              style={{
                border: `1px solid ${settings.theme === t ? 'var(--accent)' : 'var(--border)'}`,
                background:
                  settings.theme === t
                    ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                    : 'transparent',
                color: settings.theme === t ? 'var(--accent)' : 'var(--muted)',
              }}
              onClick={() => updateSettings({ theme: t })}
            >
              {t === 'light' ? '浅色' : '深色'}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">AI Providers</h3>
          <button className="btn btn-ghost !text-[12px]" onClick={() => setAdding((a) => !a)}>
            <IconPlus width={13} height={13} /> 添加自定义
          </button>
        </div>
        <p className="mb-2 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          当前生效的模型由下方「设为当前」决定。API Key 只保存在你本机浏览器中，不会被导出。
        </p>
        <button
          className="btn btn-outline mb-3 !text-[12px]"
          onClick={() => setApiKeyGuideOpen(true)}
        >
          <IconKey width={13} height={13} />
          如何获取 API Key（详细教程）
        </button>

        {adding && (
          <div className="panel mb-3 rounded-xl p-3">
            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                className="input"
                placeholder="显示名称"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              />
              <input
                className="input"
                placeholder="Base URL，如 https://api.example.com/v1"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              />
              <input
                className="input"
                placeholder="模型名"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                disabled={!draft.displayName || !draft.baseUrl || !draft.model}
                onClick={() => {
                  addProvider({
                    displayName: draft.displayName,
                    baseUrl: draft.baseUrl,
                    model: draft.model,
                    kind: 'openai-compatible',
                    enabled: true,
                  });
                  setDraft({ displayName: '', baseUrl: '', model: '' });
                  setAdding(false);
                }}
              >
                添加
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {settings.providers.map((p) => {
            const active = p.id === settings.activeProviderId;
            return (
              <div
                key={p.id}
                className="rounded-xl p-3"
                style={{
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                    : 'transparent',
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-medium">{p.displayName}</span>
                  {active && <span className="chip !text-[10px]">当前使用</span>}
                  <div className="ml-auto flex items-center gap-1">
                    {!active && (
                      <button className="btn btn-ghost !text-[12px]" onClick={() => setActiveProvider(p.id)}>
                        设为当前
                      </button>
                    )}
                    {!p.builtin && (
                      <button
                        className="btn btn-ghost"
                        title="删除该 Provider"
                        onClick={() => {
                          if (confirm(`删除 Provider「${p.displayName}」？`)) removeProvider(p.id);
                        }}
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    )}
                  </div>
                </div>

                {p.kind === 'mock' ? (
                  <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                    离线演示模式，无需 API Key，用于验证界面流程。
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <label className="col-span-1 text-[11px]" style={{ color: 'var(--faint)' }}>
                      Base URL
                      <input
                        className="input mt-1 !py-1.5"
                        value={p.baseUrl}
                        onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                      />
                    </label>
                    <label className="col-span-1 text-[11px]" style={{ color: 'var(--faint)' }}>
                      模型
                      <input
                        className="input mt-1 !py-1.5"
                        value={p.model}
                        onChange={(e) => updateProvider(p.id, { model: e.target.value })}
                      />
                    </label>
                    <label
                      className="col-span-1 text-[11px] md:col-span-2"
                      style={{ color: 'var(--faint)' }}
                    >
                      API Key（仅存本机）
                      <input
                        className="input mt-1 !py-1.5"
                        type="password"
                        placeholder="sk-…"
                        value={secrets[p.id] ?? ''}
                        onChange={(e) => setSecret(p.id, e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">联网搜索</h3>
          <button
            className="btn !text-[12px]"
            style={{
              border: `1px solid ${settings.search.enabled ? 'var(--accent)' : 'var(--border)'}`,
              color: settings.search.enabled ? 'var(--accent)' : 'var(--muted)',
            }}
            onClick={() => setSearchEnabled(!settings.search.enabled)}
          >
            {settings.search.enabled ? '已开启' : '已关闭'}
          </button>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          开启后，每次提问会先用下面的服务检索网页，再把结果作为参考资料交给模型。
          搜索 Key 与 AI Key 一样，只保存在本机浏览器，不会被导出。
        </p>

        <div className="mb-3 flex items-center gap-2 text-[12px]">
          <span style={{ color: 'var(--muted)' }}>每次检索条数</span>
          <input
            className="input !w-20 !py-1"
            type="number"
            min={1}
            max={10}
            value={settings.search.maxResults}
            onChange={(e) => setSearchMaxResults(Number(e.target.value) || 5)}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {settings.search.providers.map((p) => {
            const active = p.id === settings.search.activeProviderId;
            return (
              <div
                key={p.id}
                className="rounded-xl p-3"
                style={{
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                    : 'transparent',
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-medium">{p.displayName}</span>
                  {active && <span className="chip !text-[10px]">当前使用</span>}
                  {!active && (
                    <button
                      className="btn btn-ghost ml-auto !text-[12px]"
                      onClick={() => setActiveSearchProvider(p.id)}
                    >
                      设为当前
                    </button>
                  )}
                </div>
                <input
                  className="input !py-1.5"
                  type="password"
                  placeholder="搜索服务 API Key"
                  value={secrets[p.id] ?? ''}
                  onChange={(e) => setSecret(p.id, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[13px] font-semibold">深度思考（默认值）</h3>
        <div className="flex flex-col gap-2.5 text-[12.5px]">
          <Toggle
            label="默认开启深度思考"
            checked={settings.thinking.enabled}
            onChange={(v) => setThinking({ enabled: v })}
          />
          <label className="flex items-center justify-between gap-4">
            <span style={{ color: 'var(--muted)' }}>思考强度</span>
            <select
              className="input !w-28 !py-1"
              value={settings.thinking.effort}
              onChange={(e) => setThinking({ effort: e.target.value as ThinkingEffort })}
            >
              <option value="low">低</option>
              <option value="high">高</option>
              <option value="max">最高</option>
            </select>
          </label>
          <p className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
            仅对支持思考模式的服务商（DeepSeek）生效；在对话输入框上方也可以随时临时切换。
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[13px] font-semibold">思考辅助</h3>
        <div className="flex flex-col gap-2.5 text-[12.5px]">
          <Toggle
            label="每次回答后，让 AI 提议探索方向"
            checked={settings.reasoning.suggestBranches}
            onChange={(v) => updateSettings({ reasoning: { ...settings.reasoning, suggestBranches: v } })}
          />
          <p className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
            建议只是「提议」，只有你点击后才会真正创建分支。关闭它可以减少模型调用。
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[13px] font-semibold">上下文引擎</h3>
        <div className="flex flex-col gap-2.5 text-[12.5px]">
          <Toggle
            label="发送项目概述"
            checked={settings.context.includeProjectSummary}
            onChange={(v) => updateContext({ includeProjectSummary: v })}
          />
          <Toggle
            label="发送上层主题摘要（利用树结构减少无关上下文）"
            checked={settings.context.includeAncestorSummaries}
            onChange={(v) => updateContext({ includeAncestorSummaries: v })}
          />
          <label className="flex items-center justify-between gap-4">
            <span style={{ color: 'var(--muted)' }}>最多包含多少层上层主题</span>
            <input
              className="input !w-20 !py-1"
              type="number"
              min={1}
              max={12}
              value={settings.context.ancestorDepth}
              onChange={(e) => updateContext({ ancestorDepth: Number(e.target.value) || 1 })}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span style={{ color: 'var(--muted)' }}>每层摘要最大字数</span>
            <input
              className="input !w-20 !py-1"
              type="number"
              min={40}
              max={800}
              value={settings.context.maxAncestorChars}
              onChange={(e) => updateContext({ maxAncestorChars: Number(e.target.value) || 240 })}
            />
          </label>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[13px] font-semibold">隐私与数据</h3>
        <p className="mb-2 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          你的思考只属于你。我们不收集、不分析、不分享任何内容。
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline" onClick={() => setPrivacyOpen(true)}>
            查看完整隐私说明
          </button>
          <button className="btn btn-outline" onClick={() => setFeedbackOpen(true)}>
            反馈问题
          </button>
        </div>
      </section>

      <section
        className="rounded-xl p-3"
        style={{ border: '1px solid color-mix(in srgb, #dc2626 40%, transparent)' }}
      >
        <h3 className="mb-1 text-[13px] font-semibold" style={{ color: '#dc2626' }}>
          危险操作
        </h3>
        <p className="mb-2 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          清空<strong>这台设备</strong>上的全部 ThinkingSpace 数据（项目、主题、对话、API Key），
          并恢复到初始示例。此操作不可撤销，建议先导出备份。
          <br />
          已登录时，<strong>云端数据不会被删除</strong>，下次同步会重新拉回来。
        </p>
        <button
          className="btn"
          style={{ border: '1px solid #dc2626', color: '#dc2626' }}
          onClick={() => {
            if (
              confirm(
                '确定要清空全部本地数据吗？\n所有项目、主题、对话与 API Key 都会被删除，且无法恢复。',
              )
            ) {
              resetToSample();
              setOpen(false);
            }
          }}
        >
          清空并恢复初始数据
        </button>
      </section>
    </Modal>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="flex items-center justify-between gap-4 text-left"
      onClick={() => onChange(!checked)}
    >
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
        style={{ background: checked ? 'var(--accent)' : 'var(--border-strong)' }}
      >
        <span
          className="absolute h-3.5 w-3.5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(3px)' }}
        />
      </span>
    </button>
  );
}
