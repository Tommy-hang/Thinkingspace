// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { buildThoughtReplay } from '../lib/replay';
import type { ReplayEventKind } from '../types';
import { IconHistory, IconSpark, IconX } from './icons';

const KIND_META: Record<ReplayEventKind, { label: string; color: string }> = {
  project: { label: '起点', color: '#4f46e5' },
  topic: { label: '主题', color: '#0891b2' },
  branch: { label: '分支', color: '#7c3aed' },
  understanding: { label: '理解', color: '#16a34a' },
  insight: { label: '综合', color: '#d97706' },
};

function formatTime(at: number): string {
  return new Date(at).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 思考回放：拖动时间轴，看这张知识结构是怎么一步步长出来的 */
export function ThoughtReplayView() {
  const open = useStore((s) => s.replayOpen);
  const setOpen = useStore((s) => s.setReplayOpen);
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const nodes = useStore((s) => s.nodes);
  const messages = useStore((s) => s.messages);
  const locateNode = useStore((s) => s.locateNode);

  const replay = useMemo(
    () => (project ? buildThoughtReplay(project, nodes, messages) : null),
    [project, nodes, messages],
  );

  const [cursor, setCursor] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 每次打开都从「看完整段时间」开始
  useEffect(() => {
    if (!open || !replay) return;
    setCursor(replay.endAt);
    setPlaying(false);
  }, [open, replay]);

  const duration = replay ? Math.max(1, replay.endAt - replay.startAt) : 1;

  useEffect(() => {
    if (!playing || !replay) return;
    const stepMs = 40;
    const inc = (duration / 7000) * stepMs;
    const timer = window.setInterval(() => {
      setCursor((c) => Math.min(replay.endAt, c + inc));
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [playing, replay, duration]);

  useEffect(() => {
    if (playing && replay && cursor >= replay.endAt) setPlaying(false);
  }, [playing, cursor, replay]);

  const visible = useMemo(
    () => (replay ? replay.events.filter((e) => e.at <= cursor) : []),
    [replay, cursor],
  );

  useEffect(() => {
    const el = listRef.current;
    if (el && playing) el.scrollTop = el.scrollHeight;
  }, [visible.length, playing]);

  if (!open || !project || !replay) return null;

  const atEnd = cursor >= replay.endAt;

  const play = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (atEnd) setCursor(replay.startAt);
    setPlaying(true);
  };

  const openEvent = (nodeId?: string) => {
    if (!nodeId) return;
    setOpen(false);
    locateNode(nodeId);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg)' }}>
      <header
        className="flex shrink-0 items-center gap-2 px-3"
        style={{ height: 52, background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}
      >
        <IconHistory width={17} height={17} />
        <span className="text-[14px] font-semibold">思考回放</span>
        <span className="chip hidden max-w-[160px] truncate lg:inline-flex">{project.title}</span>
        <span className="hidden text-[11px] lg:inline" style={{ color: 'var(--faint)' }}>
          {replay.events.length} 个事件 · {formatTime(replay.startAt)} 起
        </span>
        <button
          className="btn btn-ghost ml-auto px-2"
          onClick={() => setOpen(false)}
          title="关闭"
        >
          <IconX width={16} height={16} />
        </button>
      </header>

      <div
        className="flex shrink-0 items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel-2)' }}
      >
        <button className="btn btn-outline shrink-0" onClick={play}>
          {playing ? '暂停' : '播放'}
        </button>
        <input
          type="range"
          className="ts-scrubber min-w-0 flex-1"
          min={replay.startAt}
          max={replay.endAt}
          value={cursor}
          onChange={(e) => {
            setPlaying(false);
            setCursor(Number(e.target.value));
          }}
        />
        <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {formatTime(cursor)}
        </span>
      </div>

      <div className="ts-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4" ref={listRef}>
        <div className="mx-auto max-w-[760px]">
          {visible.length === 0 && (
            <p className="py-8 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              拖动时间轴，或点「播放」，看这个思考空间是怎么形成的。
            </p>
          )}

          <div className="flex flex-col">
            {visible.map((e, i) => {
              const meta = KIND_META[e.kind];
              return (
                <div key={`${e.kind}-${e.nodeId ?? 'p'}-${e.at}-${i}`} className="flex gap-3">
                  <div className="flex w-4 shrink-0 flex-col items-center">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {i < visible.length - 1 && (
                      <span className="w-px flex-1" style={{ background: 'var(--border)' }} />
                    )}
                  </div>
                  <button
                    className="mb-3 min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition-colors"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      cursor: e.nodeId ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(ev) => {
                      if (e.nodeId) {
                        ev.currentTarget.style.background =
                          'color-mix(in srgb, var(--text) 4%, transparent)';
                      }
                    }}
                    onMouseLeave={(ev) => {
                      ev.currentTarget.style.background = 'var(--panel)';
                    }}
                    onClick={() => openEvent(e.nodeId)}
                  >
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="chip !px-1.5 !py-0 !text-[10px]">{meta.label}</span>
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                        {e.title}
                      </span>
                      <span className="ml-auto shrink-0 text-[10.5px]" style={{ color: 'var(--faint)' }}>
                        {formatTime(e.at)}
                      </span>
                    </div>
                    {e.detail && (
                      <div
                        className="text-[12px] leading-relaxed"
                        style={{ color: 'var(--muted)' }}
                      >
                        {e.detail}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {atEnd && (
            <div className="mt-2 flex flex-col gap-3">
              {replay.conclusions.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{
                    background: 'var(--accent-soft)',
                    border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  }}
                >
                  <div
                    className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    <IconSpark width={13} height={13} />
                    最终形成的理解
                  </div>
                  <div className="flex flex-col gap-2">
                    {replay.conclusions.map((c) => (
                      <button
                        key={c.id}
                        className="text-left"
                        onClick={() => openEvent(c.id)}
                        title="点击定位"
                      >
                        <div className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>
                          {c.title}
                        </div>
                        <div className="text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                          {c.summary}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {replay.abandoned.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ border: '1px solid var(--border)', background: 'var(--panel-2)' }}
                >
                  <div
                    className="mb-2 text-[12px] font-semibold"
                    style={{ color: 'var(--muted)' }}
                  >
                    被搁置或隐藏的分支 · {replay.abandoned.length}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {replay.abandoned.map((a) => (
                      <button
                        key={a.id}
                        className="chip"
                        title={`${a.reason} · 点击定位`}
                        onClick={() => openEvent(a.id)}
                      >
                        {a.title} · {a.reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
