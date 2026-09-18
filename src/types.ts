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
  | 'behavior'
  | 'question';

export interface ContextPart {
  kind: ContextPartKind;
  /** 展示用短标签，如「项目目标」「上游主题」 */
  label: string;
  /** 具体内容，如主题名 / 轮数 / 锚点文字 */
  detail?: string;
  /** 这部分大约占多少字（用于上下文占用统计） */
  chars?: number;
}

export interface ContextManifest {
  parts: ContextPart[];
  /** 同一项目里、本次没有加入的其它主题数量 */
  excludedTopics: number;
  /** 估算的上下文字数（含系统提示词） */
  totalChars: number;
  /** V2 上下文检视：可解释「为什么只发了这些」 */
  inspector?: ContextInspector;
}

/** 上下文检视数据（V2） */
export interface ContextInspector {
  /** 全部可用动态内容（字） */
  availableChars: number;
  /** 实际选中（字） */
  selectedChars: number;
  /** 因预算不足被排除（字） */
  excludedChars: number;
  memoryCount: number;
  historyCount: number;
  historyDependency: string;
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
  /** 本会话（这张卡片）的 Behavior Profile；不设置则继承全局 */
  behaviorId?: string;
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
  /** 本次回答最终采用的 Behavior Profile（三级作用域解析后的结果） */
  behaviorId?: string;
  /** 本次 API 调用的归一化用量 */
  usage?: AiUsage;
  /** 本次的成本决策记录（思考强度 / 输出预算 / 前缀指纹） */
  plan?: RequestPlan;
  /** 若这是「换个视角重新思考」的产物，记录它基于哪条回答 */
  rethinkOf?: string;
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

/* ============================ Behavior Profiles ============================ */

/**
 * 行为维度：0 = 左端，4 = 右端，2 = 中间。
 * 用数字而不是枚举，是为了让 Profile 可以有「程度」，并且以后能直接扩展新维度。
 */
export interface BehaviorDimensions {
  /** 聚焦 ↔ 发散 */
  focus: number;
  /** 简洁 ↔ 详尽 */
  length: number;
  /** 保守 ↔ 创意 */
  risk: number;
  /** 支持 ↔ 批判 */
  stance: number;
  /** 自由 ↔ 结构化 */
  form: number;
}

export type BehaviorDimensionKey = keyof BehaviorDimensions;

/**
 * 计算预算倾向（**预留能力**，v0.6.14 只存不用）。
 * 未来用于决定 reasoning effort / 输出长度 / 上下文策略 / 模型选择。
 */
export type ComputeBudget = 'quick' | 'balanced' | 'deep';

export interface BehaviorProfile {
  id: string;
  name: string;
  /** 一句话说明，用于界面提示 */
  hint?: string;
  /** 内置 Profile：不可删除、不可改名 */
  builtin?: boolean;
  dimensions: BehaviorDimensions;
  /** 用户自己写的额外行为说明（会追加到系统提示词） */
  instructions?: string;
  /** 预留：计算预算倾向 */
  compute?: ComputeBudget;
  createdAt?: number;
  updatedAt?: number;
}

/* ============================ AI Usage ============================ */

/** 费用的可信程度：不伪造数据，不确定就说不确定 */
export type UsageCostKind = 'exact' | 'estimated' | 'free' | 'unavailable';

/** 归一化后的单次 API 调用用量（与具体 Provider 无关） */
export interface AiUsage {
  providerId: string;
  provider: string;
  model: string;

  inputTokens?: number;
  /** 命中 Provider 上下文缓存的部分 */
  cachedInputTokens?: number;
  /** 未命中缓存、按全价计费的部分 */
  uncachedInputTokens?: number;
  reasoningTokens?: number;
  outputTokens?: number;
  totalTokens?: number;

  /** 费用拆分（美元） */
  inputCost?: number;
  cachedInputCost?: number;
  outputCost?: number;

  costKind: UsageCostKind;
  /** 实际总费用 */
  costUsd?: number;
  /** 假如所有 input 都没命中缓存，input 部分会是多少钱 */
  baselineInputCost?: number;
  /** 缓存省下的钱 = baselineInputCost - 实际 inputCost */
  cacheSavingsUsd?: number;
  /** 缓存命中率 0~1 */
  cacheHitRate?: number;

  currency: 'USD';
  latencyMs?: number;
  at: number;
}

/** 思考强度（与 Provider 无关的抽象） */
export type ReasoningLevel = 'none' | 'low' | 'high' | 'max';

/** 期望回答长度（与 Provider 无关的抽象） */
export type OutputBudget = 'compact' | 'normal' | 'detailed' | 'deep';

/**
 * 一次请求的「成本决策记录」：为什么这样调模型。
 * 全部由**规则**产生，不额外调用任何模型。
 */
export interface RequestPlan {
  reasoning: ReasoningLevel;
  /** 一句话解释为什么这样选 */
  reasoningWhy: string;
  outputBudget: OutputBudget;
  /** 输出 token 上限（安全网，防止明显失控的超长回答） */
  maxOutputTokens?: number;
  outputWhy: string;
  /** 稳定前缀指纹：变了说明 Provider Cache 可能失效 */
  prefixFingerprint: string;
  stableChars: number;
  dynamicChars: number;
}

/** 每 100 万 token 的价格（美元） */
export interface ModelPrice {
  input: number;
  output: number;
  cachedInput?: number;
  reasoning?: number;
}

export interface BehaviorSettings {
  /** 全局默认 Profile（新会话使用） */
  activeProfileId: string;
  profiles: BehaviorProfile[];
  /** 是否在回答下方显示用量（可关，默认开） */
  showUsage: boolean;
  /** 用户自定义的模型价格（键为模型名），优先于内置价格表 */
  customPrices?: Record<string, ModelPrice>;
}

/**
 * Cost-Aware Runtime 的开关。
 * 每一项智能优化都必须能单独关闭 —— 出问题时可以快速定位、回滚与 A/B。
 */
export interface RuntimeSettings {
  /** 稳定前缀优先：把稳定内容固定在前面，提高 Provider Cache 命中率 */
  stablePrefix: boolean;
  /** 按问题难度自动选择思考强度（纯规则，不额外调用模型） */
  adaptiveReasoning: boolean;
  /** 按问题类型自动给出回答长度预算 */
  adaptiveOutput: boolean;
  /** 上下文智能：依赖检测 / 相关检索 / 上下文预算（V2） */
  contextIntelligence: boolean;
}

export interface Settings {
  activeProviderId: string;
  providers: ProviderConfig[];
  theme: 'light' | 'dark';
  context: ContextSettings;
  thinking: ThinkingSettings;
  search: SearchSettings;
  reasoning: ReasoningSettings;
  behavior: BehaviorSettings;
  runtime: RuntimeSettings;
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
