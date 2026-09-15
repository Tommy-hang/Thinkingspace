import type {
  GraphEdge,
  Message,
  OpenQuestion,
  PersistedData,
  Project,
  ProviderConfig,
  ReasoningSettings,
  SearchProviderConfig,
  SearchSettings,
  Settings,
  ThinkingSettings,
  TopicNode,
} from '../types';
import { uid } from './id';

export const DATA_KEY = 'thinkingspace.data.v1';
export const SECRETS_KEY = 'thinkingspace.secrets.v1';

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    kind: 'openai-compatible',
    enabled: true,
    builtin: true,
    thinkingStyle: 'deepseek',
    presetModels: [
      { id: 'deepseek-flash', label: 'DeepSeek-V4.1-Flash', hint: '1M 上下文' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro', hint: '最强推理' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek-V4-Flash', hint: '旧名' },
    ],
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    kind: 'openai-compatible',
    enabled: false,
    builtin: true,
    thinkingStyle: 'none',
    presetModels: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: '快速' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'o4-mini', label: 'o4-mini', hint: '深度思考' },
    ],
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    kind: 'openai-compatible',
    enabled: false,
    builtin: true,
    thinkingStyle: 'none',
    presetModels: [
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', hint: '深度思考' },
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini Flash' },
    ],
  },
  {
    id: 'mock',
    displayName: '离线演示（无需 API Key）',
    baseUrl: '',
    model: 'mock',
    kind: 'mock',
    enabled: true,
    builtin: true,
    thinkingStyle: 'none',
    presetModels: [{ id: 'mock', label: '离线演示' }],
  },
];

export const DEFAULT_SEARCH_PROVIDERS: SearchProviderConfig[] = [
  {
    id: 'tavily',
    displayName: 'Tavily（推荐）',
    kind: 'tavily',
    endpoint: 'https://api.tavily.com/search',
    enabled: true,
    builtin: true,
  },
  {
    id: 'exa',
    displayName: 'Exa',
    kind: 'exa',
    endpoint: 'https://api.exa.ai/search',
    enabled: true,
    builtin: true,
  },
  {
    id: 'serper',
    displayName: 'Serper（Google 结果）',
    kind: 'serper',
    endpoint: 'https://google.serper.dev/search',
    enabled: true,
    builtin: true,
  },
];

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  enabled: false,
  activeProviderId: 'tavily',
  providers: DEFAULT_SEARCH_PROVIDERS,
  maxResults: 5,
};

export const DEFAULT_THINKING: ThinkingSettings = {
  enabled: true,
  effort: 'high',
};

export const DEFAULT_REASONING: ReasoningSettings = {
  suggestBranches: true,
};

export const DEFAULT_SETTINGS: Settings = {
  activeProviderId: 'mock',
  providers: DEFAULT_PROVIDERS,
  theme: 'light',
  context: {
    includeProjectSummary: true,
    includeAncestorSummaries: true,
    ancestorDepth: 6,
    maxAncestorChars: 240,
  },
  thinking: DEFAULT_THINKING,
  search: DEFAULT_SEARCH_SETTINGS,
  reasoning: DEFAULT_REASONING,
};

export type Secrets = Record<string, string>;

function buildSample(): {
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
} {
  const now = Date.now();
  const projectId = uid('p_');

  const mk = (
    title: string,
    summary: string,
    parentId: string | null,
    x: number,
    y: number,
    status: TopicNode['status'] = 'active',
    anchor?: TopicNode['anchor'],
  ): TopicNode => ({
    id: uid('n_'),
    projectId,
    parentId,
    title,
    summary,
    position: { x, y },
    status,
    anchor,
    createdAt: now,
    updatedAt: now,
  });

  const root = mk(
    'Transformer 是怎么工作的',
    '从整体结构理解 Transformer：它由哪些部分组成，为什么这样设计。',
    null,
    0,
    0,
    'exploring',
  );
  const attention = mk(
    'Attention 机制',
    'Attention 为什么有效？它是如何让模型关注到相关信息的。',
    root.id,
    340,
    -160,
    'active',
  );
  const position = mk(
    'Positional Encoding',
    'Transformer 没有循环结构，位置信息是如何被注入的。',
    root.id,
    340,
    40,
    'parked',
  );
  const ffn = mk(
    'Feed Forward Network',
    '每个 Block 里的前馈网络承担了什么角色。',
    root.id,
    340,
    240,
    'active',
  );
  const qkv = mk(
    '为什么需要 QKV',
    'Query / Key / Value 三者的分工，以及点积注意力的直觉。',
    attention.id,
    680,
    -240,
    'exploring',
    {
      sourceNodeId: attention.id,
      anchorText: 'The attention score is scaled by √dₖ',
      parentContextSummary: attention.summary,
    },
  );

  const nodes = [root, attention, position, ffn, qkv];

  const edges: GraphEdge[] = [
    { id: uid('e_'), projectId, source: root.id, target: attention.id, type: 'branch', createdAt: now },
    { id: uid('e_'), projectId, source: root.id, target: position.id, type: 'branch', createdAt: now },
    { id: uid('e_'), projectId, source: root.id, target: ffn.id, type: 'branch', createdAt: now },
    { id: uid('e_'), projectId, source: attention.id, target: qkv.id, type: 'branch', createdAt: now },
  ];

  const msg = (nodeId: string, role: Message['role'], content: string): Message => ({
    id: uid('m_'),
    nodeId,
    role,
    content,
    createdAt: now,
  });

  const messages: Message[] = [
    msg(
      root.id,
      'user',
      '我想系统地理解 Transformer，应该从哪里开始？',
    ),
    msg(
      root.id,
      'assistant',
      '可以把 Transformer 拆成三块来理解：\n\n1. Attention —— 决定「每个词该看谁」；\n2. Positional Encoding —— 把顺序信息注入进来；\n3. Feed Forward Network —— 对每个位置做非线性变换。\n\n这三块堆叠成 Block，再堆叠成模型。建议先从 Attention 入手，因为它是 Transformer 与传统 RNN 最大的区别。',
    ),
    msg(attention.id, 'user', '那 Attention 到底在做什么？'),
    msg(
      attention.id,
      'assistant',
      'Attention 的本质是「加权求和」：对当前位置，计算它与其他所有位置的关联强度，然后按强度把信息加权聚合过来。\n\n所以每个词不再只依赖前一个词，而是可以直接看到整句话里所有相关的位置——这就是它相比 RNN 的关键优势。',
    ),
    msg(qkv.id, 'user', '为什么需要 QKV 三个矩阵，而不是一个？'),
    msg(
      qkv.id,
      'assistant',
      '因为「我在找什么」「我是什么」「我能提供什么」是三种不同的角色：\n\n• Query：当前位置想查询什么；\n• Key：每个位置能匹配什么；\n• Value：每个位置真正提供的内容。\n\n用同一套表示兼任三个角色会限制表达能力，拆开之后模型可以学到更丰富的关系。',
    ),
  ];

  const project: Project = {
    id: projectId,
    title: 'Transformer 学习',
    summary: '从零理解 Transformer 的整体结构与核心机制。',
    createdAt: now,
    updatedAt: now,
  };

  return { projects: [project], nodes, edges, messages };
}

export function createDefaultData(): PersistedData {
  const sample = buildSample();
  return {
    version: 1,
    ...sample,
    settings: DEFAULT_SETTINGS,
    activeProjectId: sample.projects[0].id,
  };
}

export function loadData(): PersistedData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return createDefaultData();
    const parsed = JSON.parse(raw) as Partial<PersistedData>;
    if (!parsed || !Array.isArray(parsed.projects)) return createDefaultData();

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...parsed.settings,
      context: { ...DEFAULT_SETTINGS.context, ...parsed.settings?.context },
      providers: mergeProviders(parsed.settings?.providers),
      thinking: { ...DEFAULT_SETTINGS.thinking, ...parsed.settings?.thinking },
      reasoning: { ...DEFAULT_SETTINGS.reasoning, ...parsed.settings?.reasoning },
      search: {
        ...DEFAULT_SETTINGS.search,
        ...parsed.settings?.search,
        providers: mergeSearchProviders(parsed.settings?.search?.providers),
      },
    };

    const migrated = migrateOpenQuestions(parsed.projects ?? [], parsed.nodes ?? []);

    return {
      version: 1,
      projects: migrated.projects,
      nodes: migrated.nodes,
      edges: parsed.edges ?? [],
      messages: parsed.messages ?? [],
      settings,
      activeProjectId: parsed.activeProjectId ?? parsed.projects?.[0]?.id ?? null,
    };
  } catch (err) {
    console.error('[ThinkingSpace] 读取本地数据失败，已回退到默认数据。', err);
    return createDefaultData();
  }
}

/**
 * V0.3.5 早期把「待解决问题」存在各个主题上，导致不同卡片看到不同清单。
 * 这里把它们合并到项目级，保证所有卡片显示同一份。
 */
export function migrateOpenQuestions(
  projects: Project[],
  nodes: TopicNode[],
): { projects: Project[]; nodes: TopicNode[] } {
  const hasLegacy = nodes.some((n) => {
    const legacy = (n as { openQuestions?: OpenQuestion[] }).openQuestions;
    return Array.isArray(legacy) && legacy.length > 0;
  });
  if (!hasLegacy) return { projects, nodes };

  const nextProjects = projects.map((p) => ({
    ...p,
    openQuestions: [...(p.openQuestions ?? [])],
  }));
  const byId = new Map(nextProjects.map((p) => [p.id, p]));

  const nextNodes = nodes.map((n) => {
    const legacy = (n as { openQuestions?: OpenQuestion[] }).openQuestions;
    if (Array.isArray(legacy) && legacy.length > 0) {
      const project = byId.get(n.projectId);
      if (project) {
        project.openQuestions = [
          ...(project.openQuestions ?? []),
          ...legacy.map((q) => ({ ...q, sourceNodeId: q.sourceNodeId ?? n.id })),
        ];
      }
    }
    const copy = { ...n } as TopicNode & { openQuestions?: unknown };
    delete copy.openQuestions;
    return copy as TopicNode;
  });

  return { projects: nextProjects, nodes: nextNodes };
}

function mergeSearchProviders(saved?: SearchProviderConfig[]): SearchProviderConfig[] {
  if (!saved || saved.length === 0) return DEFAULT_SEARCH_PROVIDERS;
  const byId = new Map(saved.map((p) => [p.id, p]));
  const merged = DEFAULT_SEARCH_PROVIDERS.map((p) => ({ ...p, ...byId.get(p.id) }));
  const extra = saved.filter((p) => !DEFAULT_SEARCH_PROVIDERS.some((d) => d.id === p.id));
  return [...merged, ...extra];
}

/** 已下线的旧模型名，读取旧数据时自动迁移到新模型 */
const RETIRED_MODELS: Record<string, string> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
};

function mergeProviders(saved?: ProviderConfig[]): ProviderConfig[] {
  if (!saved || saved.length === 0) return DEFAULT_PROVIDERS;
  const byId = new Map(saved.map((p) => [p.id, p]));

  // 内置服务商：模型清单、名称、地址等一律以代码为准（它们会随官方更新而变化），
  // 只保留用户自己的选择（选了哪个模型、是否启用）。
  const merged = DEFAULT_PROVIDERS.map((p) => {
    const savedProvider = byId.get(p.id);
    if (!savedProvider) return p;
    const next: ProviderConfig = {
      ...p,
      model: savedProvider.model || p.model,
      enabled: savedProvider.enabled ?? p.enabled,
    };
    if (RETIRED_MODELS[next.model]) next.model = RETIRED_MODELS[next.model];
    return next;
  });

  // 用户自己添加的服务商原样保留
  const extra = saved.filter((p) => !DEFAULT_PROVIDERS.some((d) => d.id === p.id));
  return [...merged, ...extra];
}

export function saveData(data: PersistedData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[ThinkingSpace] 保存本地数据失败。', err);
  }
}

export function loadSecrets(): Secrets {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    return raw ? (JSON.parse(raw) as Secrets) : {};
  } catch {
    return {};
  }
}

export function saveSecrets(secrets: Secrets): void {
  try {
    localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
  } catch (err) {
    console.error('[ThinkingSpace] 保存密钥失败。', err);
  }
}

export function clearAllData(): void {
  localStorage.removeItem(DATA_KEY);
}
