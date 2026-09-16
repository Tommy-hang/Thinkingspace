import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { NODE_STATUS } from '../types';
import { Modal } from './Modal';
import { IconLayers } from './icons';

/**
 * 综合节点：选中多个主题，让 AI 把它们收敛成一个更高层的认识。
 * 综合节点会记录来源、综合观点、未解决的矛盾，并在来源更新后提示「可能已过期」。
 */
export function SynthesisPanel() {
  const open = useStore((s) => s.synthesisOpen);
  const setOpen = useStore((s) => s.setSynthesisOpen);
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const nodes = useStore((s) => s.nodes);
  const createSynthesisNode = useStore((s) => s.createSynthesisNode);
  const focusNode = useStore((s) => s.focusNode);

  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => (project ? nodes.filter((n) => n.projectId === project.id && !n.hidden) : []),
    [nodes, project],
  );

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open || !project) return null;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const run = async () => {
    if (selected.length < 2) {
      setError('至少选择 2 个主题才能综合。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createSynthesisNode(selected);
      if (id) {
        setOpen(false);
        focusNode(id);
      } else {
        setError('综合失败，请稍后重试。');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="综合多个主题" onClose={() => setOpen(false)} width={620}>
      <div
        className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed"
        style={{
          background: 'var(--accent-soft)',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          color: 'var(--text)',
        }}
      >
        <span className="mt-[2px] shrink-0" style={{ color: 'var(--accent)' }}>
          <IconLayers width={14} height={14} />
        </span>
        <span>
          选中 2 个以上主题，AI 会读取它们的<strong>「当前理解」</strong>，
          收敛成一段统一认识，并单独记下<strong>尚未解决的矛盾</strong>。
          综合结果会成为一张新卡片，并用引用线连回来源主题。
        </span>
      </div>

      <div className="mb-2 text-[11px]" style={{ color: 'var(--faint)' }}>
        选择要综合的主题（已选 {selected.length}）
      </div>

      <div className="ts-scroll mb-4 flex max-h-[42vh] flex-col gap-1 overflow-y-auto">
        {candidates.length === 0 && (
          <p className="py-4 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>
            这个项目还没有可综合的主题。
          </p>
        )}
        {candidates.map((n) => {
          const checked = selected.includes(n.id);
          const status = NODE_STATUS[n.status];
          return (
            <button
              key={n.id}
              className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors"
              style={{
                border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                background: checked
                  ? 'color-mix(in srgb, var(--accent) 7%, transparent)'
                  : 'transparent',
              }}
              onClick={() => toggle(n.id)}
            >
              <span
                className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px]"
                style={{
                  border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: checked ? 'var(--accent)' : 'transparent',
                }}
              >
                {checked && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: status.color }}
                  />
                  <span className="truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    {n.title}
                  </span>
                  {n.synthesis && (
                    <span className="chip shrink-0 !px-1.5 !py-0 !text-[10px]">综合</span>
                  )}
                </span>
                {(n.insight || n.summary) && (
                  <span
                    className="mt-0.5 block text-[11.5px] leading-relaxed"
                    style={{
                      color: 'var(--muted)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {n.insight || n.summary}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
          style={{
            background: 'color-mix(in srgb, #dc2626 10%, transparent)',
            border: '1px solid color-mix(in srgb, #dc2626 30%, transparent)',
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>
          取消
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || selected.length < 2}
          style={{ opacity: busy || selected.length < 2 ? 0.5 : 1 }}
          onClick={() => void run()}
        >
          <IconLayers width={14} height={14} />
          {busy ? '综合中…' : `综合 ${selected.length} 个主题`}
        </button>
      </div>
    </Modal>
  );
}
