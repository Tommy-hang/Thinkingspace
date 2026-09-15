import { useCallback, useEffect, useMemo, useRef } from 'react';
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

const nodeTypes = { topic: TopicCardNode };

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
  const statusFilter = useStore((s) => s.statusFilter);
  const revealNodeId = useStore((s) => s.revealNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const moveNode = useStore((s) => s.moveNode);
  const addEdge = useStore((s) => s.addEdge);
  const clearReveal = useStore((s) => s.clearReveal);
  const createRootNode = useStore((s) => s.createRootNode);

  const project = projects.find((p) => p.id === activeProjectId);
  const projectNodes = useMemo(
    () => nodes.filter((n) => n.projectId === activeProjectId),
    [nodes, activeProjectId],
  );

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
      setCenter(node.position.x + 124, node.position.y + 60, {
        zoom: 1.1,
        duration: 500,
      });
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

  const messageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) map.set(m.nodeId, (map.get(m.nodeId) ?? 0) + 1);
    return map;
  }, [messages]);

  const flowNodes: TopicFlowNode[] = useMemo(
    () =>
      projectNodes.map((n) => ({
        id: n.id,
        type: 'topic' as const,
        position: n.position,
        selected: n.id === selectedNodeId,
        data: {
          topic: n,
          messageCount: messageCount.get(n.id) ?? 0,
          branchCount: childCount.get(n.id) ?? 0,
          isDimmed: statusFilter !== 'all' && n.status !== statusFilter,
        },
      })),
    [projectNodes, selectedNodeId, messageCount, childCount, statusFilter],
  );

  const visibleIds = useMemo(() => new Set(projectNodes.map((n) => n.id)), [projectNodes]);

  const flowEdges: TopicFlowEdge[] = useMemo(
    () =>
      edges
        .filter((e) => e.projectId === activeProjectId && visibleIds.has(e.source) && visibleIds.has(e.target))
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'default',
          data: { edgeType: e.type },
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--border-strong)' },
        })),
    [edges, activeProjectId, visibleIds],
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
        onPaneClick={() => selectNode(null)}
        onConnect={(connection) => {
          if (connection.source && connection.target) {
            addEdge(connection.source, connection.target, 'reference');
          }
        }}
        onNodeDoubleClick={(event, node) => handleOpen(node.id, event)}
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
        <Controls
          showInteractive={false}
          className="ts-controls"
          position="bottom-right"
        />
      </ReactFlow>

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
