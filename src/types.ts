import type { Edge, Node } from '@xyflow/react';

export type NodeStatus = 'active' | 'exploring' | 'resolved' | 'parked';

export const NODE_STATUS: Record<
  NodeStatus,
  { label: string; color: string; description: string }
> = {
  active: {
    label: '进行中',
    color: '#4f46e5',
    description: '当前正在思考的主题',
  },
  exploring: {
    label: '探索中',
    color: '#0891b2',
    description: '还有未解决的问题，正在展开',
  },
  resolved: {
    label: '已收敛',
    color: '#16a34a',
    description: '这一主题已经有明确结论',
  },
  parked: {
    label: '暂搁置',
    color: '#a8a29e',
    description: '暂时放下，以后再看',
  },
};

export type EdgeType = 'branch' | 'reference' | 'contrast' | 'dependency' | 'example';

export const EDGE_TYPES: Record<EdgeType, { label: string }> = {
  branch: { label: '分支' },
  reference: { label: '引用' },
  contrast: { label: '对照' },
  dependency: { label: '依赖' },
  example: { label: '例证' },
};

export interface BranchAnchor {
  sourceNodeId: string;
  sourceMessageId?: string;
  anchorText?: string;
  parentContextSummary?: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
}

export interface TopicNode {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  summary: string;
  position: { x: number; y: number };
  status: NodeStatus;
  anchor?: BranchAnchor;
  createdAt: number;
  updatedAt: number;
}

export interface SearchSource {
  title: string;
  url: string;
  content: string;
}

export interface Message {
  id: string;
  nodeId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** 深度思考模型返回的推理过程 */
  reasoning?: string;
  /** 本轮回答所依据的联网搜索结果 */
  sources?: SearchSource[];
  createdAt: number;
  /** true while the model is still streaming into this message */
  pending?: boolean;
  error?: boolean;
}

export interface ModelPreset {
  id: string;
  label: string;
  hint?: string;
}

export interface GraphEdge {
  id: string;
  projectId: string;
  source: string;
  target: string;
  type: EdgeType;
  createdAt: number;
}

export type ProviderKind = 'openai-compatible' | 'mock';

/** 如何向该服务商表达「开启/关闭深度思考」 */
export type ThinkingStyle = 'deepseek' | 'none';

export type ThinkingEffort = 'low' | 'high' | 'max';

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  model: string;
  kind: ProviderKind;
  enabled: boolean;
  builtin?: boolean;
  presetModels?: ModelPreset[];
  thinkingStyle?: ThinkingStyle;
}

export interface ThinkingSettings {
  enabled: boolean;
  effort: ThinkingEffort;
}

export type SearchProviderKind = 'tavily' | 'exa' | 'serper';

export interface SearchProviderConfig {
  id: string;
  displayName: string;
  kind: SearchProviderKind;
  endpoint: string;
  enabled: boolean;
  builtin?: boolean;
}

export interface SearchSettings {
  enabled: boolean;
  activeProviderId: string;
  providers: SearchProviderConfig[];
  maxResults: number;
}

export interface ContextSettings {
  includeProjectSummary: boolean;
  includeAncestorSummaries: boolean;
  ancestorDepth: number;
  maxAncestorChars: number;
}

export interface Settings {
  activeProviderId: string;
  providers: ProviderConfig[];
  theme: 'light' | 'dark';
  context: ContextSettings;
  thinking: ThinkingSettings;
  search: SearchSettings;
}

export interface PersistedData {
  version: number;
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
  settings: Settings;
  activeProjectId: string | null;
}

export interface TopicNodeData extends Record<string, unknown> {
  topic: TopicNode;
  messageCount: number;
  branchCount: number;
  isDimmed: boolean;
}

export type TopicFlowNode = Node<TopicNodeData, 'topic'>;

export type TopicFlowEdge = Edge<{ edgeType: EdgeType }>;

export interface ExportBundle {
  format: 'thinkingspace';
  version: number;
  exportedAt: number;
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
}
