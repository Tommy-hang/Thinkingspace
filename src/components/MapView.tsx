import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type NodeChange,
} from '@xyflow/react';
import { useStore } from '../store/store';
import { TopicCardNode } from './TopicCardNode';
import type { TopicFlowEdge, TopicFlowNode } from '../types';
import { EmptyState } from './EmptyState';
import { getAncestors, getDescendantIds, getVisibleNodes } from '../lib/tree';
import { isTouchDevice } from '../lib/device';
import { intentLabel } from '../lib/branchIntent';

const nodeTypes = { topic: TopicCardNode };

const HOVER_DELAY = 520;

interface MapViewProps {
  onOpenNode: (nodeId: string, rect: DOMRect | null) => void;
}

export function MapView({ onOpenNode }: MapViewProps) {
  const projects = useStore((s) => s.projects);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const messages = useStore((s) => s.messages);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const focusedNodeId = useStore((s) => s.focusedNodeId);
  const statusFilter = useStore((s) => s.statusFilter);
  const revealNodeId = useStore((s) => s.revealNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const moveNode = useStore((s) => s.moveNode);
  const addEdge = useStore((s) => s.addEdge);
  const clearReveal = useStore((s) => s.clearReveal);
  const createRootNode = useStore((s) => s.createRootNode);
  const beginNodeDrag = useStore((s) => s.beginNodeDrag);
  const endNodeDrag = useStore((s) => s.endNodeDrag);
  const openNodeMenu = useStore((s) => s.openNodeMenu);

  const project = projects.find((p) => p.id === activeProjectId);
  const projectNodes = useMemo(
    () => nodes.filter((n) => n.projectId === activeProjectId),
    [nodes, activeProjectId],
  );

  const visibleNodes = useMemo(() => getVisibleNodes(projectNodes), [projectNodes]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const { setCenter, fitView } = useReactFlow();
  const lastProject = useRef<string | null>(null);

  useEffect(() => {
    if (!activeProjectId || lastProject.current === activeProjectId) return;
    lastProject.current = activeProjectId;
    const timer = setTimeout(() => fitView({ padding: 0.32, duration: 450 }), 60);
    return () => clearTimeout(timer);
  }, [activeProjectId, fitView]);

  useEffect(() => {
    if (!revealNodeId) return;
    const node = nodes.find((n) => n.id === revealNodeId);
    if (node) {
      setCenter(node.position.x + 124, node.position.y + 60, { zoom: 1.1, duration: 500 });
    }
    clearReveal();
  }, [revealNodeId, nodes, setCenter, clearReveal]);

  const childCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of projectNodes) {
      if (n.parentId) map.set(n.parentId, (map.get(n.parentId) ?? 0) + 1);
    }
    return map;
  }, [projectNodes]);

  const hiddenCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of projectNodes) {
      if (n.collapsed) map.set(n.id, getDescendantIds(projectNodes, n.id).size);
    }
    return map;
  }, [projectNodes]);

  const messageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) map.set(m.nodeId, (map.get(m.nodeId) ?? 0) + 1);
    return map;
  }, [messages]);

  // 思考路径：选中 / 正在聚焦的主题的祖先链
  const pathAnchorId = focusedNodeId ?? selectedNodeId;
  const pathIds = useMemo(() => {
    if (!pathAnchorId) return null;
    return new Set(getAncestors(nodes, pathAnchorId).map((n) => n.id));
  }, [nodes, pathAnchorId]);

  const flowNodes: TopicFlowNode[] = useMemo(
    () =>
      visibleNodes.map((n) => {
        const statusDim = statusFilter !== 'all' && n.status !== statusFilter;
        const onPath = pathIds ? pathIds.has(n.id) : false;
        const pathDim = pathIds !== null && !onPath;
        return {
          id: n.id,
          type: 'topic' as const,
          position: n.position,
          selected: n.id === selectedNodeId,
          data: {
            topic: n,
            messageCount: messageCount.get(n.id) ?? 0,
            branchCount: childCount.get(n.id) ?? 0,
            dimOpacity: statusDim ? 0.3 : pathDim ? 0.45 : 1,
            onPath,
            hiddenCount: hiddenCount.get(n.id) ?? 0,
          },
        };
      }),
    [visibleNodes, selectedNodeId, messageCount, childCount, statusFilter, pathIds, hiddenCount],
  );

  const flowEdges: TopicFlowEdge[] = useMemo(
    () =>
      edges
        .filter(
          (e) =>
            e.projectId === activeProjectId &&
            visibleIds.has(e.source) &&
            visibleIds.has(e.target),
        )
        .map((e) => {
          const onPath = pathIds ? pathIds.has(e.source) && pathIds.has(e.target) : false;
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'default',
            data: { edgeType: e.type },
            style: onPath ? { stroke: 'var(--accent)', strokeWidth: 2 } : undefined,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: onPath ? 'var(--accent)' : 'var(--border-strong)',
            },
          };
        }),
    [edges, activeProjectId, visibleIds, pathIds],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<TopicFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position);
        }
      }
    },
    [moveNode],
  );

  const handleOpen = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      const el = (event.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null;
      const rect = el ? el.getBoundingClientRect() : null;
      selectNode(nodeId);
      onOpenNode(nodeId, rect);
    },
    [selectNode, onOpenNode],
  );

  // ---------- Hover Preview ----------
  const [preview, setPreview] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const dragging = useRef(false);

  const cancelPreview = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setPreview(null);
  }, []);

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      // 触屏没有 hover，悬停预览会与「点击进入」冲突
      if (dragging.current || isTouchDevice()) return;
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => {
        hoverTimer.current = null;
        if (dragging.current) return;
        const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
        const rect = el?.getBoundingClientRect();
        if (!rect) return;
        setPreview({ nodeId: node.id, x: rect.right + 14, y: rect.top });
      }, HOVER_DELAY);
    },
    [],
  );

  const handleNodeMouseLeave = useCallback(() => {
    cancelPreview();
  }, [cancelPreview]);

  const previewNode = preview ? nodes.find((n) => n.id === preview.nodeId) : null;
  const previewMessages = useMemo(
    () => (previewNode ? messages.filter((m) => m.nodeId === previewNode.id) : []),
    [previewNode, messages],
  );
  const previewLast = useMemo(
    () => [...previewMessages].reverse().find((m) => m.role === 'assistant' && m.content.trim()),
    [previewMessages],
  );

  useEffect(() => {
    cancelPreview();
  }, [activeProjectId, cancelPreview]);

  if (!project) {
    return <EmptyState />;
  }

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(event, node) => handleOpen(node.id, event)}
        onPaneClick={() => {
          selectNode(null);
          openNodeMenu(null);
          cancelPreview();
        }}
        onConnect={(connection) => {
          if (connection.source && connection.target) {
            addEdge(connection.source, connection.target, 'reference');
          }
        }}
        onNodeDragStart={(_e, node) => {
          dragging.current = true;
          cancelPreview();
          openNodeMenu(null);
          beginNodeDrag(node.id);
        }}
        onNodeDragStop={(_e, node) => {
          dragging.current = false;
          endNodeDrag(node.id);
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          cancelPreview();
          selectNode(node.id);
          openNodeMenu(node.id, { x: event.clientX, y: event.clientY });
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          openNodeMenu(null);
        }}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        minZoom={0.15}
        maxZoom={2.2}
        fitView
        fitViewOptions={{ padding: 0.32 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'default' }}
        nodesDraggable
        panOnScroll
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
        className="ts-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.4}
          color="var(--canvas-dots)"
        />
        <Controls showInteractive={false} className="ts-controls" position="bottom-right" />
      </ReactFlow>

      {preview && previewNode && (
        <div
          className="panel ts-fade-up ts-hover-preview pointer-events-none fixed z-30 w-[304px] rounded-xl p-3.5"
          style={{
            left: Math.max(12, Math.min(preview.x, window.innerWidth - 320)),
            top: Math.max(12, Math.min(preview.y, window.innerHeight - 240)),
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `var(--accent)` }}
            />
            <span className="text-[13px] font-semibold">{previewNode.title}</span>
          </div>
          {previewNode.summary && (
            <p
              className="mb-2 text-[11.5px] leading-relaxed"
              style={{
                color: 'var(--muted)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {previewNode.summary}
            </p>
          )}
          {previewLast && (
            <p
              className="mb-2 text-[11.5px] leading-relaxed"
              style={{
                color: 'var(--text)',
                opacity: 0.78,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {previewLast.content.replace(/[#*`>]/g, '').slice(0, 260)}
            </p>
          )}
          <div
            className="flex items-center gap-3 pt-2 text-[10.5px]"
            style={{ borderTop: '1px solid var(--border)', color: 'var(--faint)' }}
          >
            <span>{Math.ceil(previewMessages.length / 2)} 轮</span>
            <span>{childCount.get(previewNode.id) ?? 0} 个分支</span>
            {intentLabel(previewNode.intent) && (
              <span className="chip !py-0 !text-[10px]">{intentLabel(previewNode.intent)}</span>
            )}
            <span className="ml-auto">点击打开</span>
          </div>
        </div>
      )}

      {projectNodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto text-center">
            <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>
              这个项目还没有主题
            </p>
            <button className="btn btn-primary" onClick={() => createRootNode()}>
              创建第一个主题
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
