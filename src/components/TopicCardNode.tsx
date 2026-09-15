import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { NODE_STATUS, type TopicFlowNode } from '../types';
import { useStore } from '../store/store';
import { intentLabel } from '../lib/branchIntent';
import { IconBranch, IconChevronDown, IconChevronRight, IconMore, IconPin } from './icons';

function TopicCardNodeImpl({ data, selected }: NodeProps<TopicFlowNode>) {
  const { topic, messageCount, branchCount, dimOpacity, onPath, hiddenCount } = data;
  const status = NODE_STATUS[topic.status];
  const turns = Math.ceil(messageCount / 2);
  const intent = intentLabel(topic.intent);
  const openCount = (topic.openQuestions ?? []).filter((q) => !q.resolved).length;

  const openNodeMenu = useStore((s) => s.openNodeMenu);
  const toggleCollapse = useStore((s) => s.toggleCollapse);

  const accent = 'var(--node-selected)';
  const borderColor = selected || onPath ? accent : 'var(--node-border)';

  return (
    <div
      className="group relative rounded-2xl px-3.5 py-3 transition-all duration-200"
      style={{
        width: 248,
        background: 'var(--node-bg)',
        border: `1px solid ${borderColor}`,
        boxShadow: selected
          ? '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)'
          : onPath
            ? '0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent), var(--shadow)'
            : 'var(--shadow)',
        opacity: dimOpacity,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: status.color }}
          title={status.label}
        />
        <span
          className="truncate text-[10px] font-medium tracking-wider uppercase"
          style={{ color: 'var(--faint)' }}
        >
          {status.label}
        </span>

        {topic.pinned && (
          <span style={{ color: 'var(--accent)' }} title="已收藏">
            <IconPin width={11} height={11} />
          </span>
        )}

        {intent && (
          <span className="chip shrink-0 !px-1.5 !py-0 !text-[10px]">{intent}</span>
        )}

        {!intent && topic.anchor?.anchorText && (
          <span className="chip shrink-0 !px-1.5 !py-0 !text-[10px]">锚点</span>
        )}

        <button
          className="ml-auto shrink-0 rounded px-1 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--faint)' }}
          title="更多操作"
          onClick={(e) => {
            e.stopPropagation();
            openNodeMenu(topic.id);
          }}
        >
          <IconMore width={14} height={14} />
        </button>
      </div>

      <h3 className="mb-1 text-[14px] leading-snug font-semibold" style={{ color: 'var(--text)' }}>
        {topic.title || '未命名主题'}
      </h3>

      {topic.summary ? (
        <p
          className="mb-2.5 text-[12px] leading-relaxed"
          style={{
            color: 'var(--muted)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {topic.summary}
        </p>
      ) : (
        <p className="mb-2.5 text-[12px] italic" style={{ color: 'var(--faint)' }}>
          还没有内容
        </p>
      )}

      <div
        className="flex items-center gap-3 pt-2 text-[11px]"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--faint)' }}
      >
        <span>{turns} 轮</span>
        <span className="inline-flex items-center gap-1">
          <IconBranch width={11} height={11} />
          {branchCount}
        </span>

        {openCount > 0 && (
          <span
            className="inline-flex items-center gap-0.5"
            style={{ color: 'var(--accent)' }}
            title="待解决问题"
          >
            ? {openCount}
          </span>
        )}

        {topic.collapsed && hiddenCount > 0 && (
          <button
            className="inline-flex items-center gap-0.5 rounded px-1"
            style={{ color: 'var(--accent)' }}
            title="展开子主题"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(topic.id);
            }}
          >
            <IconChevronRight width={11} height={11} />
            隐藏 {hiddenCount}
          </button>
        )}

        {!topic.collapsed && branchCount > 0 && (
          <button
            className="ml-auto inline-flex items-center gap-0.5 rounded px-1 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--faint)' }}
            title="折叠子主题"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(topic.id);
            }}
          >
            <IconChevronDown width={11} height={11} />
          </button>
        )}

        <span
          className={
            topic.collapsed
              ? 'opacity-0 transition-opacity group-hover:opacity-100'
              : 'ml-auto opacity-0 transition-opacity group-hover:opacity-100'
          }
        >
          打开 →
        </span>
      </div>
    </div>
  );
}

export const TopicCardNode = memo(TopicCardNodeImpl);
