// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

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

/** 创建分支时用户表达的「认知动作」 */
export type BranchIntent =
  | 'branch'
  | 'explore'
  | 'why'
  | 'example'
  | 'counterexample'
  | 'connection'
  | 'custom';

/** 应用内最近发生的错误，用于「反馈问题」时携带诊断信息 */
export interface ErrorLogEntry {
  at: number;
  scope: string;
  message: string;
}

export interface HistorySnapshot {
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
  activeProjectId: string | null;
}

/** 尚未解决的问题 —— 属于整个项目，在每张卡片里看到的是同一份清单 */
export interface OpenQuestion {
  id: string;
  text: string;
  resolved?: boolean;
  /** 这条问题来自哪个主题（用于标注来源与跳转） */
  sourceNodeId?: string;
  sourceMessageId?: string;
  createdAt: number;
}

/** AI 提出的探索方向，需用户确认后才创建分支 */
export interface BranchSuggestion {
  intent: BranchIntent;
  label: string;
  question: string;
}

/** 「上下文透镜」：一次回答实际使用了哪些内容 */
export type ContextPartKind =
  | 'project'
  | 'ancestor'
  | 'anchor'
  | 'search'
  | 'mention'
  | 'conversation'
  | 'question';

export interface ContextPart {
  kind: ContextPartKind;
  /** 展示用短标签，如「项目目标」「上游主题」 */
  label: string;
  /** 具体内容，如主题名 / 轮数 / 锚点文字 */
  detail?: string;
}

export interface ContextManifest {
  parts: ContextPart[];
  /** 同一项目里、本次没有加入的其它主题数量 */
  excludedTopics: number;
  /** 估算的上下文字数（含系统提示词） */
  totalChars: number;
}

/** 「当前理解」的一个历史版本 */
export interface SummaryVersion {
  text: string;
  at: number;
}

/** 综合节点：由多个主题收敛而成 */
export interface SynthesisSource {
  id: string;
  title: string;
  /** 综合时该主题的「当前理解」更新时间，用于判断综合是否过期 */
  updatedAt: number;
}

export interface SynthesisMeta {
  sourceNodeIds: string[];
  sources: SynthesisSource[];
  /** 综合后得到的统一观点 */
  conclusion: string;
  /** 尚未解决的矛盾或分歧（可为空） */
  contradictions: string;
  generatedAt: number;
}

/** 思考回放：由时间戳推导出的一个事件 */
export type ReplayEventKind =
  | 'project'
  | 'topic'
  | 'branch'
  | 'understanding'
  | 'insight';

export interface ReplayEvent {
  at: number;
  kind: ReplayEventKind;
  nodeId?: string;
  title: string;
  detail?: string;
}

/** 知识地图上的一个知识点（只描述知识，不描述卡片） */
export interface KnowledgePoint {
  id: string;
  label: string;
  /** 这个知识点来自哪些主题卡片 */
  sourceNodeIds: string[];
  children: KnowledgePoint[];
}

/** 由所有卡片的「当前理解」综合而成的项目级知识地图 */
export interface KnowledgeMap {
  generatedAt: number;
  root: KnowledgePoint;
}

export interface KnowledgeNodeData extends Record<string, unknown> {
  label: string;
  sources: { id: string; title: string }[];
  depth: number;
  isRoot: boolean;
}

export type KnowledgeFlowNode = Node<KnowledgeNodeData, 'knowledge'>;

export interface Project {
  id: string;
  title: string;
  summary: string;
  /** 项目级「待解决问题」，所有卡片共享同一份 */
  openQuestions?: OpenQuestion[];
  /** 由全部卡片的「当前理解」生成的知识点思维导图 */
  knowledgeMap?: KnowledgeMap;
  /** 上次同步时云端的版本号（仅本地记录，用于发现冲突） */
  cloudRevision?: number;
  /** 上次同步时云端的更新时间（仅本地记录，用于判断云端是否变过） */
  cloudUpdatedAt?: number;
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
  /** 用户标记为「重要」（独立于认知状态） */
  pinned?: boolean;
  /** 折叠：本节点仍显示，隐藏其所有后代 */
  collapsed?: boolean;
  /** 隐藏：本节点及其后代都不显示（仅影响地图，不删除数据） */
  hidden?: boolean;
  /** 标题是否已被用户手动固定（true 时不再自动生成标题） */
  titleLocked?: boolean;
  /** 该分支诞生时的认知动作 */
  intent?: BranchIntent;
  /** 「当前理解」的生成时间 */
  summaryUpdatedAt?: number;
  /** 「当前理解」的历史版本（保留最近 10 个） */
  summaryVersions?: SummaryVersion[];
  /** 待用户确认的新「当前理解」——差异确认后才会成为正式版本 */
  pendingSummary?: { text: string; title?: string; proposedAt: number };
  /** Merge Insights：由子分支综合而成的更高层理解 */
  insight?: string;
  insightUpdatedAt?: number;
  /** 综合节点：由多个主题收敛而成 */
  synthesis?: SynthesisMeta;
  /** AI 建议的探索方向（挂在最后一条回答上） */
  suggestions?: BranchSuggestion[];
  suggestionsFor?: string;
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
  /** 本条提问通过 @ 引用了哪些主题 */
  mentions?: string[];
  /** 本次回答实际使用了哪些上下文（上下文透镜） */
  contextManifest?: ContextManifest;
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

export interface ReasoningSettings {
  /** 每次回答后是否自动让 AI 提议探索方向 */
  suggestBranches: boolean;
}

export interface Settings {
  activeProviderId: string;
  providers: ProviderConfig[];
  theme: 'light' | 'dark';
  context: ContextSettings;
  thinking: ThinkingSettings;
  search: SearchSettings;
  reasoning: ReasoningSettings;
}

export interface PersistedData {
  version: number;
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
  settings: Settings;
  activeProjectId: string | null;
  /** 最近访问过的主题（仅本机） */
  recentNodeIds?: string[];
}

export interface TopicNodeData extends Record<string, unknown> {
  topic: TopicNode;
  messageCount: number;
  branchCount: number;
  /** 1 = 正常；小于 1 表示被状态筛选或路径高亮淡化 */
  dimOpacity: number;
  onPath: boolean;
  /** 被该节点折叠隐藏的后代数量 */
  hiddenCount: number;
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
