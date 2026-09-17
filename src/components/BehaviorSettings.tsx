// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useState } from 'react';
import { useStore } from '../store/store';
import type { BehaviorDimensions, BehaviorProfile } from '../types';
import {
  BEHAVIOR_DIMENSIONS,
  BEHAVIOR_DIMENSION_MAX,
  BEHAVIOR_DIMENSION_MIN,
} from '../lib/behavior';
import { MODEL_PRICES } from '../lib/pricing';
import { IconCheck, IconPlus, IconSliders, IconTrash } from './icons';

const MID: BehaviorDimensions = { focus: 2, length: 2, risk: 2, stance: 2, form: 2 };

/**
 * 行为倾向（Behavior Profiles）与用量/费用设置。
 * 默认保持克制：Profile 列表平时只出现在这里和聊天页的轻量入口里。
 */
export function BehaviorSettings() {
  const behavior = useStore((s) => s.settings.behavior);
  const setActiveBehavior = useStore((s) => s.setActiveBehavior);
  const addBehavior = useStore((s) => s.addBehavior);
  const updateBehavior = useStore((s) => s.updateBehavior);
  const removeBehavior = useStore((s) => s.removeBehavior);
  const setShowUsage = useStore((s) => s.setShowUsage);
  const setCustomPrice = useStore((s) => s.setCustomPrice);
  const removeCustomPrice = useStore((s) => s.removeCustomPrice);
  const providers = useStore((s) => s.settings.providers);

  const [editing, setEditing] = useState<BehaviorProfile | null>(null);
  const [priceModel, setPriceModel] = useState('');
  const [priceIn, setPriceIn] = useState('');
  const [priceOut, setPriceOut] = useState('');

  const customPrices = behavior.customPrices ?? {};

  const startNew = () =>
    setEditing({
      id: '',
      name: '',
      hint: '',
      dimensions: { ...MID },
      instructions: '',
    });

  const saveEditing = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    if (editing.id) {
      updateBehavior(editing.id, {
        name,
        hint: editing.hint?.trim() || undefined,
        dimensions: editing.dimensions,
        instructions: editing.instructions?.trim() || undefined,
      });
    } else {
      addBehavior({
        name,
        hint: editing.hint?.trim() || undefined,
        dimensions: editing.dimensions,
        instructions: editing.instructions?.trim() || undefined,
      });
    }
    setEditing(null);
  };

  const addPrice = () => {
    const model = priceModel.trim();
    const input = Number(priceIn);
    const output = Number(priceOut);
    if (!model || !Number.isFinite(input) || !Number.isFinite(output)) return;
    setCustomPrice(model, { input, output });
    setPriceModel('');
    setPriceIn('');
    setPriceOut('');
  };

  return (
    <>
      <section className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">行为倾向（Behavior）</h3>
          <button className="btn btn-ghost !text-[12px]" onClick={startNew}>
            <IconPlus width={13} height={13} /> 新建自定义
          </button>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          控制模型「如何思考」：思考范围、长度、结论取向、立场与组织形式。
          标为「默认」的那个会成为<strong>新会话</strong>的行为；
          每个主题还可以单独覆盖，单条消息也能临时切换。
        </p>

        {editing && (
          <BehaviorEditor
            draft={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={saveEditing}
          />
        )}

        <div className="flex flex-col gap-2">
          {behavior.profiles.map((p) => {
            const active = p.id === behavior.activeProfileId;
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
                <div className="mb-1 flex items-center gap-2">
                  <IconSliders width={13} height={13} />
                  <span className="text-[13px] font-medium">{p.name}</span>
                  {p.builtin && (
                    <span className="chip !px-1.5 !py-0 !text-[10px]">内置</span>
                  )}
                  {active && <span className="chip !text-[10px]">新会话默认</span>}
                  <div className="ml-auto flex items-center gap-1">
                    {!active && (
                      <button
                        className="btn btn-ghost !text-[12px]"
                        onClick={() => setActiveBehavior(p.id)}
                      >
                        设为默认
                      </button>
                    )}
                    {!p.builtin && (
                      <>
                        <button
                          className="btn btn-ghost !text-[12px]"
                          onClick={() => setEditing({ ...p, dimensions: { ...p.dimensions } })}
                        >
                          编辑
                        </button>
                        <button
                          className="btn btn-ghost"
                          title="删除该 Profile"
                          onClick={() => {
                            if (confirm(`删除行为倾向「${p.name}」？`)) removeBehavior(p.id);
                          }}
                        >
                          <IconTrash width={14} height={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {p.hint && (
                  <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {p.hint}
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {BEHAVIOR_DIMENSIONS.map((d) => (
                    <span
                      key={d.key}
                      className="text-[10.5px]"
                      style={{ color: 'var(--faint)' }}
                      title={`${d.low} ↔ ${d.high}`}
                    >
                      {d.label}：{dimensionWord(p.dimensions[d.key])}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[13px] font-semibold">用量与费用</h3>
        <Toggle
          label="在每条回答下方显示 token 与费用"
          checked={behavior.showUsage}
          onChange={setShowUsage}
        />
        <p className="mt-2 mb-3 text-[11.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
          费用按「模型单价 × token 数」<strong>估算</strong>，用 ≈ 标注；
          价格表内置常见模型，官方调价后可在这里覆盖。无法确定价格的模型会显示「价格未知」。
        </p>

        <div className="mb-2 text-[12px]" style={{ color: 'var(--muted)' }}>
          已内置价格的模型：
          <span className="ml-1" style={{ color: 'var(--faint)' }}>
            {Object.keys(MODEL_PRICES).join('、')}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {Object.entries(customPrices).map(([model, price]) => (
            <div
              key={model}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]"
              style={{ border: '1px solid var(--border)' }}
            >
              <span className="min-w-0 flex-1 truncate">{model}</span>
              <span style={{ color: 'var(--faint)' }}>
                入 ${price.input} / 出 ${price.output} （每百万 token）
              </span>
              <button
                className="btn btn-ghost !px-1.5 !py-0"
                title="删除该价格"
                onClick={() => removeCustomPrice(model)}
              >
                <IconTrash width={13} height={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px]" style={{ color: 'var(--faint)' }}>
            模型名
            <input
              className="input mt-1 !py-1.5 !text-[12px]"
              style={{ width: 200 }}
              list="ts-known-models"
              placeholder="如 deepseek-v4-pro"
              value={priceModel}
              onChange={(e) => setPriceModel(e.target.value)}
            />
          </label>
          <datalist id="ts-known-models">
            {providers.map((p) => (
              <option key={p.id} value={p.model} />
            ))}
          </datalist>
          <label className="text-[11px]" style={{ color: 'var(--faint)' }}>
            输入价
            <input
              className="input mt-1 !w-24 !py-1.5 !text-[12px]"
              placeholder="0.28"
              value={priceIn}
              onChange={(e) => setPriceIn(e.target.value)}
            />
          </label>
          <label className="text-[11px]" style={{ color: 'var(--faint)' }}>
            输出价
            <input
              className="input mt-1 !w-24 !py-1.5 !text-[12px]"
              placeholder="0.42"
              value={priceOut}
              onChange={(e) => setPriceOut(e.target.value)}
            />
          </label>
          <button className="btn btn-outline !text-[12px]" onClick={addPrice}>
            <IconPlus width={13} height={13} /> 添加价格
          </button>
        </div>
      </section>
    </>
  );
}

function BehaviorEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: BehaviorProfile;
  onChange: (p: BehaviorProfile) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const setDim = (key: keyof BehaviorDimensions, value: number) =>
    onChange({ ...draft, dimensions: { ...draft.dimensions, [key]: value } });

  return (
    <div
      className="mb-3 rounded-xl p-3"
      style={{
        border: '1px solid var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
      }}
    >
      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-[11px]" style={{ color: 'var(--faint)' }}>
          名称
          <input
            className="input mt-1 !py-1.5 !text-[12px]"
            placeholder="如：审稿人"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="text-[11px]" style={{ color: 'var(--faint)' }}>
          一句话说明（可选）
          <input
            className="input mt-1 !py-1.5 !text-[12px]"
            placeholder="如：像审稿人一样挑毛病"
            value={draft.hint ?? ''}
            onChange={(e) => onChange({ ...draft, hint: e.target.value })}
          />
        </label>
      </div>

      <div className="mb-2 flex flex-col gap-2.5">
        {BEHAVIOR_DIMENSIONS.map((d) => {
          const value = draft.dimensions[d.key];
          return (
            <div key={d.key}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--muted)' }}>{d.label}</span>
                <span style={{ color: 'var(--faint)' }}>{dimensionWord(value)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-right text-[10.5px]" style={{ color: 'var(--faint)' }}>
                  {d.low}
                </span>
                <input
                  type="range"
                  className="ts-scrubber min-w-0 flex-1"
                  min={BEHAVIOR_DIMENSION_MIN}
                  max={BEHAVIOR_DIMENSION_MAX}
                  step={1}
                  value={value}
                  onChange={(e) => setDim(d.key, Number(e.target.value))}
                />
                <span className="w-10 shrink-0 text-[10.5px]" style={{ color: 'var(--faint)' }}>
                  {d.high}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <label className="text-[11px]" style={{ color: 'var(--faint)' }}>
        补充行为说明（可选，会原样追加到提示词）
        <textarea
          className="input ts-scroll mt-1 resize-none !text-[12px]"
          rows={2}
          placeholder="如：始终给出一个具体的反例"
          value={draft.instructions ?? ''}
          onChange={(e) => onChange({ ...draft, instructions: e.target.value })}
        />
      </label>

      <div className="mt-2.5 flex justify-end gap-2">
        <button className="btn btn-ghost !text-[12px]" onClick={onCancel}>
          取消
        </button>
        <button
          className="btn btn-primary !text-[12px]"
          disabled={!draft.name.trim()}
          style={{ opacity: draft.name.trim() ? 1 : 0.5 }}
          onClick={onSave}
        >
          <IconCheck width={13} height={13} /> 保存
        </button>
      </div>
    </div>
  );
}

/** 0~4 → 中文程度词 */
function dimensionWord(value: number): string {
  switch (value) {
    case 0:
      return '很偏左';
    case 1:
      return '偏左';
    case 3:
      return '偏右';
    case 4:
      return '很偏右';
    default:
      return '均衡';
  }
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
      className="flex w-full items-center justify-between gap-4 text-left text-[12.5px]"
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
