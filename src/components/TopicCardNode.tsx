import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { NODE_STATUS, type TopicFlowNode } from '../types';
import { IconBranch } from './icons';

function TopicCardNodeImpl({ data, selected }: NodeProps<TopicFlowNode>) {
  const { topic, messageCount, branchCount, isDimmed } = data;
  const status = NODE_STATUS[topic.status];
  const turns = Math.ceil(messageCount / 2);

  return (
    <div
      className="group relative rounded-2xl px-3.5 py-3 transition-all duration-200"
      style={{
        width: 248,
        background: 'var(--node-bg)',
        border: `1px solid ${selected ? 'var(--node-selected)' : 'var(--node-border)'}`,
        boxShadow: selected ? '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--shadow)',
        opacity: isDimmed ? 0.32 : 1,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="mb-1.5 flex items-center gap-2">
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
        {topic.anchor?.anchorText && (
          <span className="chip ml-auto shrink-0 !px-1.5 !py-0 !text-[10px]">锚点</span>
        )}
      </div>

      <h3
        className="mb-1 text-[14px] leading-snug font-semibold"
        style={{ color: 'var(--text)' }}
      >
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
        <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
          打开 →
        </span>
      </div>
    </div>
  );
}

export const TopicCardNode = memo(TopicCardNodeImpl);
