import { useMemo } from 'react';
import { useStore } from '../store/store';
import { NODE_STATUS, type NodeStatus, type TopicNode } from '../types';
import { getHiddenIds } from '../lib/tree';
import { IconEyeOff, IconX } from './icons';

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const nodes = useStore((s) => s.nodes);
  const messages = useStore((s) => s.messages);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const statusFilter = useStore((s) => s.statusFilter);
  const setStatusFilter = useStore((s) => s.setStatusFilter);
  const revealNode = useStore((s) => s.revealNode);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const updateProjectSummary = useStore((s) => s.updateProjectSummary);
  const recentNodeIds = useStore((s) => s.recentNodeIds);
  const togglePin = useStore((s) => s.togglePin);
  const openNodeMenu = useStore((s) => s.openNodeMenu);
  const showAllHidden = useStore((s) => s.showAllHidden);
  const unhideNode = useStore((s) => s.unhideNode);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  const projectNodes = useMemo(
    () => nodes.filter((n) => n.projectId === activeProjectId),
    [nodes, activeProjectId],
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, TopicNode[]>();
    for (const n of projectNodes) {
      const key = n.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  }, [projectNodes]);

  const msgCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) map.set(m.nodeId, (map.get(m.nodeId) ?? 0) + 1);
    return map;
  }, [messages]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projectNodes.length };
    for (const s of Object.keys(NODE_STATUS) as NodeStatus[]) {
      c[s] = projectNodes.filter((n) => n.status === s).length;
    }
    return c;
  }, [projectNodes]);

  const nodeById = useMemo(
    () => new Map(projectNodes.map((n) => [n.id, n])),
    [projectNodes],
  );

  const recentNodes = useMemo(
    () =>
      recentNodeIds
        .map((id) => nodeById.get(id))
        .filter((n): n is TopicNode => Boolean(n))
        .slice(0, 6),
    [recentNodeIds, nodeById],
  );

  const pinnedNodes = useMemo(() => projectNodes.filter((n) => n.pinned), [projectNodes]);

  const hiddenIds = useMemo(() => getHiddenIds(projectNodes), [projectNodes]);

  const openMenuAt = (event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    openNodeMenu(nodeId, { x: event.clientX, y: event.clientY });
  };

  const goToNode = (n: TopicNode) => {
    if (n.hidden) unhideNode(n.id);
    revealNode(n.id);
  };

  if (!project) return null;

  const renderTree = (parentId: string | null, depth: number) => {
    const list = childrenOf.get(parentId) ?? [];
    return list.map((n) => {
      const status = NODE_STATUS[n.status];
      const hidden = hiddenIds.has(n.id);
      const dim = hidden || (statusFilter !== 'all' && n.status !== statusFilter);
      return (
        <div key={n.id}>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors"
            style={{
              paddingLeft: 8 + depth * 12,
              background:
                n.id === selectedNodeId
                  ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'transparent',
              color: dim ? 'var(--faint)' : 'var(--text)',
            }}
            title={hidden ? '已隐藏，右键可取消隐藏' : '右键查看更多操作'}
            onClick={() => goToNode(n)}
            onContextMenu={(e) => openMenuAt(e, n.id)}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: hidden ? 'var(--border-strong)' : status.color }}
            />
            <span className="flex-1 truncate">{n.title}</span>
            {hidden ? (
              <IconEyeOff width={11} height={11} className="shrink-0" />
            ) : (
              (msgCount.get(n.id) ?? 0) > 0 && (
                <span className="shrink-0 text-[10px]" style={{ color: 'var(--faint)' }}>
                  {Math.ceil((msgCount.get(n.id) ?? 0) / 2)}
                </span>
              )
            )}
          </button>
          {renderTree(n.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <aside
      className="ts-scroll flex w-[262px] shrink-0 flex-col overflow-y-auto"
      style={{ background: 'var(--panel-2)', borderRight: '1px solid var(--border)' }}
    >
      {recentNodes.length > 0 && (
        <div className="px-3 pt-3.5 pb-1">
          <div className="mb-1 text-[10px] tracking-widest uppercase" style={{ color: 'var(--faint)' }}>
            最近
          </div>
          <div className="flex flex-col">
            {recentNodes.map((n) => (
              <NavRow
                key={n.id}
                node={n}
                onClick={() => revealNode(n.id)}
                onContextMenu={(e) => openMenuAt(e, n.id)}
              />
            ))}
          </div>
        </div>
      )}

      {pinnedNodes.length > 0 && (
        <div className="px-3 pt-2.5 pb-1">
          <div className="mb-1 text-[10px] tracking-widest uppercase" style={{ color: 'var(--faint)' }}>
            已收藏 · {pinnedNodes.length}
          </div>
          <div className="flex flex-col">
            {pinnedNodes.map((n) => (
              <NavRow
                key={n.id}
                node={n}
                onClick={() => revealNode(n.id)}
                onTogglePin={() => togglePin(n.id)}
                onContextMenu={(e) => openMenuAt(e, n.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-3 pt-3.5 pb-3">
        <div className="mb-1.5 text-[10px] tracking-widest uppercase" style={{ color: 'var(--faint)' }}>
          项目概述
        </div>
        <textarea
          className="input resize-none text-[12.5px] leading-relaxed"
          rows={3}
          placeholder="用一两句话描述这个思考空间的目标，它会作为 AI 的顶层上下文。"
          value={project.summary}
          onChange={(e) => updateProjectSummary(project.id, e.target.value)}
        />
      </div>

      <div className="px-3 pb-3">
        <div className="mb-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--faint)' }}>
          按状态筛选
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={statusFilter === 'all'}
            color="var(--text)"
            label={`全部 ${counts.all ?? 0}`}
            onClick={() => setStatusFilter('all')}
          />
          {(Object.keys(NODE_STATUS) as NodeStatus[]).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              color={NODE_STATUS[s].color}
              label={`${NODE_STATUS[s].label} ${counts[s] ?? 0}`}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 pb-1.5">
        <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--faint)' }}>
          主题结构
        </span>
        {hiddenIds.size > 0 ? (
          <button
            className="btn btn-ghost !px-1.5 !py-0 !text-[10.5px]"
            style={{ color: 'var(--accent)' }}
            title="把被隐藏的卡片全部恢复显示"
            onClick={showAllHidden}
          >
            显示全部 · {hiddenIds.size}
          </button>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
            {projectNodes.length} 个
          </span>
        )}
      </div>

      <div className="px-1.5 pb-4">{renderTree(null, 0)}</div>
    </aside>
  );
}

function NavRow({
  node,
  onClick,
  onTogglePin,
  onContextMenu,
}: {
  node: TopicNode;
  onClick: () => void;
  onTogglePin?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const status = NODE_STATUS[node.status];
  return (
    <div
      className="group flex items-center gap-2 rounded-md px-2 py-1"
      onContextMenu={onContextMenu}
    >
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onClick}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: status.color }} />
        <span className="truncate text-[12.5px]" style={{ color: 'var(--muted)' }}>
          {node.title}
        </span>
      </button>
      {onTogglePin && (
        <button
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--faint)' }}
          title="取消收藏"
          onClick={onTogglePin}
        >
          <IconX width={12} height={12} />
        </button>
      )}
    </div>
  );
}

function FilterChip({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
      style={{
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
        color: active ? color : 'var(--muted)',
      }}
      onClick={onClick}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}
