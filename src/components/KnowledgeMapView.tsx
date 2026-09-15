import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import { useStore } from '../store/store';
import type { KnowledgeFlowNode } from '../types';
import { flattenKnowledge } from '../lib/knowledgeMap';
import { layoutTree } from '../lib/layout';
import { IconMap, IconRefresh, IconSpark, IconX } from './icons';

function KnowledgeNode({ data }: NodeProps<KnowledgeFlowNode>) {
  const locateNode = useStore((s) => s.locateNode);
  const setKnowledgeOpen = useStore((s) => s.setKnowledgeOpen);
  const { label, sources, isRoot } = data;

  return (
    <div
      className="rounded-xl px-3 py-2 transition-shadow"
      style={{
        width: isRoot ? 244 : 222,
        background: isRoot ? 'var(--accent)' : 'var(--panel)',
        color: isRoot ? 'var(--accent-text)' : 'var(--text)',
        border: `1px solid ${isRoot ? 'transparent' : 'var(--border)'}`,
        boxShadow: 'var(--shadow)',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div
        className="text-[13px] leading-snug font-semibold"
        style={{ color: isRoot ? 'var(--accent-text)' : 'var(--text)' }}
      >
        {label}
      </div>

      {sources.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sources.map((source) => (
            <button
              key={source.id}
              className="rounded-full px-1.5 py-[1px] text-[10px] transition-colors"
              style={{
                background: isRoot
                  ? 'color-mix(in srgb, var(--accent-text) 22%, transparent)'
                  : 'var(--accent-soft)',
                color: isRoot ? 'var(--accent-text)' : 'var(--accent)',
                border: `1px solid ${
                  isRoot
                    ? 'color-mix(in srgb, var(--accent-text) 30%, transparent)'
                    : 'color-mix(in srgb, var(--accent) 20%, transparent)'
                }`,
              }}
              title={`点击定位到「${source.title}」`}
              onClick={(event) => {
                event.stopPropagation();
                setKnowledgeOpen(false);
                locateNode(source.id);
              }}
            >
              {source.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { knowledge: KnowledgeNode };

export function KnowledgeMapView() {
  const open = useStore((s) => s.knowledgeOpen);
  const setOpen = useStore((s) => s.setKnowledgeOpen);
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const nodes = useStore((s) => s.nodes);
  const progress = useStore((s) => s.knowledgeProgress);
  const buildKnowledgeMap = useStore((s) => s.buildKnowledgeMap);

  const map = project?.knowledgeMap;

  const flat = useMemo(() => (map ? flattenKnowledge(map.root) : []), [map]);

  const positions = useMemo(
    () =>
      layoutTree(
        flat.map((item) => ({ id: item.point.id, parentId: item.parentId })),
        { xGap: 300, yGap: 122 },
      ),
    [flat],
  );

  const flowNodes: KnowledgeFlowNode[] = useMemo(
    () =>
      flat.map((item) => ({
        id: item.point.id,
        type: 'knowledge' as const,
        position: positions.get(item.point.id) ?? { x: 0, y: 0 },
        data: {
          label: item.point.label,
          sources: item.point.sourceNodeIds
            .map((id) => nodes.find((n) => n.id === id))
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
            .map((n) => ({ id: n.id, title: n.title })),
          depth: item.depth,
          isRoot: item.depth === 0,
        },
      })),
    [flat, positions, nodes],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      flat
        .filter((item) => item.parentId)
        .map((item) => ({
          id: `${item.parentId}->${item.point.id}`,
          source: item.parentId as string,
          target: item.point.id,
          type: 'default',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 13,
            height: 13,
            color: 'var(--border-strong)',
          },
        })),
    [flat],
  );

  if (!open || !project) return null;

  const totalPoints = flat.length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg)' }}>
      <header
        className="flex shrink-0 items-center gap-2 px-3"
        style={{
          height: 52,
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <IconMap width={17} height={17} />
        <span className="text-[14px] font-semibold">知识地图</span>
        <span className="chip hidden sm:inline-flex">{project.title}</span>

        {map && !progress && (
          <span className="hidden text-[11px] md:inline" style={{ color: 'var(--faint)' }}>
            {totalPoints} 个知识点 ·{' '}
            {new Date(map.generatedAt).toLocaleString('zh-CN', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="btn btn-outline"
            disabled={Boolean(progress)}
            onClick={() => void buildKnowledgeMap()}
          >
            <IconRefresh width={14} height={14} />
            {map ? '重新生成' : '生成'}
          </button>
          <button className="btn btn-ghost px-2" onClick={() => setOpen(false)} title="关闭">
            <IconX width={16} height={16} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {progress ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
            <div className="text-[14px] font-medium">
              {progress.phase === 'summaries'
                ? '正在更新每张卡片的「当前理解」…'
                : '正在构建知识点地图…'}
            </div>

            {progress.phase === 'summaries' && progress.total > 0 && (
              <>
                <div
                  className="h-1.5 w-[280px] overflow-hidden rounded-full"
                  style={{ background: 'var(--border)' }}
                >
                  <div
                    style={{
                      width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
                      height: '100%',
                      background: 'var(--accent)',
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  {progress.current} / {progress.total}
                </div>
              </>
            )}

            <p
              className="max-w-[440px] text-center text-[11.5px] leading-relaxed"
              style={{ color: 'var(--faint)' }}
            >
              第一步会为每张「有对话」的卡片各调用一次模型；卡片越多耗时越长。
              完成后第二步只使用这些「当前理解」，不会读取全部对话。
            </p>
          </div>
        ) : map ? (
          <ReactFlowProvider>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.28 }}
              minZoom={0.15}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              panOnScroll
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
          </ReactFlowProvider>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <IconMap width={22} height={22} />
            </div>
            <h2 className="text-[17px] font-semibold">生成整个项目的知识地图</h2>
            <p
              className="max-w-[520px] text-[13px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              它会先把每张卡片的<strong>「当前理解」</strong>更新一遍，
              再根据这些理解之间的知识点关系，画出一张
              <strong>只包含知识点</strong>的思维导图。
              <br />
              每个知识点下面会标出它来自哪几张卡片，点击即可定位。
            </p>
            <p className="max-w-[520px] text-[11.5px]" style={{ color: 'var(--faint)' }}>
              不读取全部对话内容，所以成本可控；卡片越多，第一步耗时越长。
            </p>
            <button className="btn btn-primary" onClick={() => void buildKnowledgeMap()}>
              <IconSpark width={15} height={15} />
              开始生成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
