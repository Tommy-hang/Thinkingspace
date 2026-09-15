import { create } from 'zustand';
import type {
  BranchAnchor,
  ContextSettings,
  GraphEdge,
  Message,
  NodeStatus,
  PersistedData,
  Project,
  ProviderConfig,
  SearchProviderConfig,
  SearchSource,
  Settings,
  ThinkingSettings,
  TopicNode,
} from '../types';
import { uid } from '../lib/id';
import { buildContext } from '../lib/ai/contextBuilder';
import { runChat } from '../lib/ai';
import { runSearch } from '../lib/search';
import { layoutTree } from '../lib/layout';
import {
  loadData,
  loadSecrets,
  saveData,
  saveSecrets,
  clearAllData,
  type Secrets,
} from '../lib/storage';
import { parseBundle } from '../lib/exportImport';

interface UIState {
  activeProjectId: string | null;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  revealNodeId: string | null;
  searchOpen: boolean;
  settingsOpen: boolean;
  sidebarOpen: boolean;
  statusFilter: NodeStatus | 'all';
  streamingNodeId: string | null;
  searchingNodeId: string | null;
}

interface Actions {
  setActiveProject: (id: string) => void;
  createProject: (title: string) => string;
  renameProject: (id: string, title: string) => void;
  updateProjectSummary: (id: string, summary: string) => void;
  deleteProject: (id: string) => void;

  createRootNode: () => string;
  createBranch: (parentId: string, anchor?: Partial<BranchAnchor>, title?: string) => string;
  updateNode: (id: string, patch: Partial<Pick<TopicNode, 'title' | 'summary' | 'status'>>) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  applyAutoLayout: () => void;

  addEdge: (source: string, target: string, type?: GraphEdge['type']) => void;
  removeEdge: (id: string) => void;

  sendMessage: (nodeId: string, text: string) => Promise<void>;
  stopStreaming: (nodeId: string) => void;

  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  revealNode: (id: string) => void;
  clearReveal: () => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setStatusFilter: (filter: NodeStatus | 'all') => void;

  updateSettings: (patch: Partial<Settings>) => void;
  updateContextSettings: (patch: Partial<ContextSettings>) => void;
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
  useModel: (providerId: string, model: string) => void;
  addProvider: (provider: Omit<ProviderConfig, 'id'>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  setSecret: (providerId: string, value: string) => void;

  setThinking: (patch: Partial<ThinkingSettings>) => void;
  setSearchEnabled: (enabled: boolean) => void;
  setActiveSearchProvider: (id: string) => void;
  updateSearchProvider: (id: string, patch: Partial<SearchProviderConfig>) => void;
  setSearchMaxResults: (n: number) => void;

  importFromText: (text: string) => void;
  resetToSample: () => void;
}

export type StoreState = PersistedData & UIState & { secrets: Secrets } & Actions;

const initial = loadData();

const controllers = new Map<string, AbortController>();

function collectSubtree(nodes: TopicNode[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

function summarise(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

export const useStore = create<StoreState>((set, get) => ({
  ...initial,
  secrets: loadSecrets(),

  selectedNodeId: null,
  focusedNodeId: null,
  revealNodeId: null,
  searchOpen: false,
  settingsOpen: false,
  sidebarOpen: true,
  statusFilter: 'all',
  streamingNodeId: null,
  searchingNodeId: null,

  setActiveProject: (id) =>
    set({
      activeProjectId: id,
      selectedNodeId: null,
      focusedNodeId: null,
      revealNodeId: null,
      statusFilter: 'all',
    }),

  createProject: (title) => {
    const now = Date.now();
    const project: Project = {
      id: uid('p_'),
      title: title.trim() || '未命名项目',
      summary: '',
      createdAt: now,
      updatedAt: now,
    };
    const root: TopicNode = {
      id: uid('n_'),
      projectId: project.id,
      parentId: null,
      title: '新主题',
      summary: '',
      position: { x: 0, y: 0 },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      projects: [project, ...s.projects],
      nodes: [...s.nodes, root],
      activeProjectId: project.id,
      selectedNodeId: root.id,
      focusedNodeId: null,
    }));
    return project.id;
  },

  renameProject: (id, title) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, title, updatedAt: Date.now() } : p,
      ),
    })),

  updateProjectSummary: (id, summary) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, summary, updatedAt: Date.now() } : p,
      ),
    })),

  deleteProject: (id) =>
    set((s) => {
      const nodeIds = new Set(s.nodes.filter((n) => n.projectId === id).map((n) => n.id));
      const projects = s.projects.filter((p) => p.id !== id);
      const nextActive =
        s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId;
      return {
        projects,
        nodes: s.nodes.filter((n) => n.projectId !== id),
        edges: s.edges.filter((e) => e.projectId !== id),
        messages: s.messages.filter((m) => !nodeIds.has(m.nodeId)),
        activeProjectId: nextActive,
        selectedNodeId: null,
        focusedNodeId: null,
      };
    }),

  createRootNode: () => {
    const s = get();
    const projectId = s.activeProjectId;
    if (!projectId) return '';
    const now = Date.now();
    const siblings = s.nodes.filter((n) => n.projectId === projectId && n.parentId === null);
    const node: TopicNode = {
      id: uid('n_'),
      projectId,
      parentId: null,
      title: '新主题',
      summary: '',
      position: { x: 0, y: siblings.length * 168 },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ nodes: [...state.nodes, node], selectedNodeId: node.id }));
    return node.id;
  },

  createBranch: (parentId, anchor, title) => {
    const s = get();
    const parent = s.nodes.find((n) => n.id === parentId);
    if (!parent) return '';
    const now = Date.now();
    const siblings = s.nodes.filter((n) => n.parentId === parentId);
    const node: TopicNode = {
      id: uid('n_'),
      projectId: parent.projectId,
      parentId,
      title: title?.trim() || '新分支',
      summary: '',
      position: {
        x: parent.position.x + 340,
        y: parent.position.y + siblings.length * 168,
      },
      status: 'active',
      anchor: anchor
        ? {
            sourceNodeId: anchor.sourceNodeId ?? parentId,
            sourceMessageId: anchor.sourceMessageId,
            anchorText: anchor.anchorText,
            parentContextSummary: anchor.parentContextSummary ?? parent.summary,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const edge: GraphEdge = {
      id: uid('e_'),
      projectId: parent.projectId,
      source: parentId,
      target: node.id,
      type: 'branch',
      createdAt: now,
    };
    set((state) => ({
      nodes: [...state.nodes, node],
      edges: [...state.edges, edge],
      selectedNodeId: node.id,
    }));
    return node.id;
  },

  updateNode: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    })),

  moveNode: (id, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position, updatedAt: Date.now() } : n)),
    })),

  deleteNode: (id) =>
    set((s) => {
      const node = s.nodes.find((n) => n.id === id);
      if (!node) return {};
      const doomed = collectSubtree(s.nodes, id);
      return {
        nodes: s.nodes.filter((n) => !doomed.has(n.id)),
        edges: s.edges.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)),
        messages: s.messages.filter((m) => !doomed.has(m.nodeId)),
        selectedNodeId: s.selectedNodeId && doomed.has(s.selectedNodeId) ? null : s.selectedNodeId,
        focusedNodeId: s.focusedNodeId && doomed.has(s.focusedNodeId) ? null : s.focusedNodeId,
      };
    }),

  applyAutoLayout: () =>
    set((s) => {
      if (!s.activeProjectId) return {};
      const projectNodes = s.nodes.filter((n) => n.projectId === s.activeProjectId);
      const positions = layoutTree(projectNodes);
      return {
        nodes: s.nodes.map((n) =>
          positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n,
        ),
      };
    }),

  addEdge: (source, target, type = 'branch') =>
    set((s) => {
      const projectId = s.activeProjectId;
      if (!projectId || source === target) return {};
      if (s.edges.some((e) => e.source === source && e.target === target)) return {};
      const edge: GraphEdge = {
        id: uid('e_'),
        projectId,
        source,
        target,
        type,
        createdAt: Date.now(),
      };
      return { edges: [...s.edges, edge] };
    }),

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  sendMessage: async (nodeId, text) => {
    const question = text.trim();
    if (!question) return;

    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    const project = state.projects.find((p) => p.id === node?.projectId);
    if (!node || !project) return;

    const provider = state.settings.providers.find(
      (p) => p.id === state.settings.activeProviderId,
    );
    if (!provider) {
      console.error('[ThinkingSpace] 没有可用的 AI Provider。');
      return;
    }

    const now = Date.now();
    const userMessage: Message = {
      id: uid('m_'),
      nodeId,
      role: 'user',
      content: question,
      createdAt: now,
    };
    const assistantMessage: Message = {
      id: uid('m_'),
      nodeId,
      role: 'assistant',
      content: '',
      createdAt: now,
      pending: true,
    };

    set((s) => ({
      messages: [...s.messages, userMessage, assistantMessage],
      streamingNodeId: nodeId,
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              title:
                n.title === '新主题' || n.title === '新分支'
                  ? summarise(question, 24)
                  : n.title,
              summary: n.summary || summarise(question),
              status: n.status === 'resolved' ? 'active' : n.status,
              updatedAt: now,
            }
          : n,
      ),
    }));

    // ---- 联网搜索（可选）----
    let sources: SearchSource[] = [];
    const searchSettings = state.settings.search;
    if (searchSettings.enabled) {
      const searchProvider = searchSettings.providers.find(
        (p) => p.id === searchSettings.activeProviderId,
      );
      if (searchProvider) {
        set({ searchingNodeId: nodeId });
        try {
          sources = await runSearch({
            provider: searchProvider,
            apiKey: get().secrets[searchProvider.id] ?? '',
            query: question,
            maxResults: searchSettings.maxResults,
          });
          if (sources.length > 0) {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMessage.id ? { ...m, sources } : m,
              ),
            }));
          }
        } catch (err) {
          const note = `⚠️ 联网搜索失败：${
            err instanceof Error ? err.message : String(err)
          }\n\n（下面仍会尝试直接回答）\n\n`;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: m.content + note } : m,
            ),
          }));
        } finally {
          set({ searchingNodeId: null });
        }
      }
    }

    const context = buildContext({
      project,
      nodes: get().nodes,
      messages: get().messages.filter((m) => m.id !== assistantMessage.id),
      nodeId,
      question,
      settings: state.settings.context,
      searchSources: sources,
    });

    const controller = new AbortController();
    controllers.set(nodeId, controller);

    const append = (delta: string) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id ? { ...m, content: m.content + delta } : m,
        ),
      }));

    const appendReasoning = (delta: string) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, reasoning: (m.reasoning ?? '') + delta }
            : m,
        ),
      }));

    try {
      await runChat({
        provider,
        apiKey: get().secrets[provider.id] ?? '',
        messages: context,
        signal: controller.signal,
        onDelta: append,
        onReasoning: appendReasoning,
        thinking: state.settings.thinking,
      });
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id ? { ...m, pending: false } : m,
        ),
        streamingNodeId: s.streamingNodeId === nodeId ? null : s.streamingNodeId,
      }));
    } catch (err) {
      const aborted = controller.signal.aborted;
      const message = aborted
        ? '（已停止生成）'
        : `⚠️ 调用失败：${err instanceof Error ? err.message : String(err)}`;
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, pending: false, error: !aborted, content: m.content || message }
            : m,
        ),
        streamingNodeId: s.streamingNodeId === nodeId ? null : s.streamingNodeId,
      }));
    } finally {
      controllers.delete(nodeId);
    }
  },

  stopStreaming: (nodeId) => {
    controllers.get(nodeId)?.abort();
    controllers.delete(nodeId);
  },

  selectNode: (id) => set({ selectedNodeId: id }),
  focusNode: (id) => set({ focusedNodeId: id }),
  revealNode: (id) => set({ selectedNodeId: id, revealNodeId: id }),
  clearReveal: () => set({ revealNodeId: null }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  updateContextSettings: (patch) =>
    set((s) => ({
      settings: { ...s.settings, context: { ...s.settings.context, ...patch } },
    })),

  updateProvider: (id, patch) =>
    set((s) => ({
      settings: {
        ...s.settings,
        providers: s.settings.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
    })),

  useModel: (providerId, model) =>
    set((s) => ({
      settings: {
        ...s.settings,
        activeProviderId: providerId,
        providers: s.settings.providers.map((p) =>
          p.id === providerId ? { ...p, model } : p,
        ),
      },
    })),

  addProvider: (provider) => {
    const id = uid('prov_');
    set((s) => ({
      settings: {
        ...s.settings,
        providers: [...s.settings.providers, { ...provider, id }],
      },
    }));
  },

  removeProvider: (id) =>
    set((s) => {
      const providers = s.settings.providers.filter((p) => p.id !== id);
      return {
        settings: {
          ...s.settings,
          providers,
          activeProviderId:
            s.settings.activeProviderId === id
              ? (providers[0]?.id ?? '')
              : s.settings.activeProviderId,
        },
      };
    }),

  setActiveProvider: (id) =>
    set((s) => ({ settings: { ...s.settings, activeProviderId: id } })),

  setSecret: (providerId, value) => {
    const secrets = { ...get().secrets, [providerId]: value };
    saveSecrets(secrets);
    set({ secrets });
  },

  setThinking: (patch) =>
    set((s) => ({
      settings: { ...s.settings, thinking: { ...s.settings.thinking, ...patch } },
    })),

  setSearchEnabled: (enabled) =>
    set((s) => ({ settings: { ...s.settings, search: { ...s.settings.search, enabled } } })),

  setActiveSearchProvider: (id) =>
    set((s) => ({
      settings: { ...s.settings, search: { ...s.settings.search, activeProviderId: id } },
    })),

  updateSearchProvider: (id, patch) =>
    set((s) => ({
      settings: {
        ...s.settings,
        search: {
          ...s.settings.search,
          providers: s.settings.search.providers.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        },
      },
    })),

  setSearchMaxResults: (n) =>
    set((s) => ({
      settings: { ...s.settings, search: { ...s.settings.search, maxResults: n } },
    })),

  importFromText: (text) => {
    const imported = parseBundle(text);
    set((s) => ({
      projects: [...imported.projects, ...s.projects],
      nodes: [...imported.nodes, ...s.nodes],
      edges: [...imported.edges, ...s.edges],
      messages: [...imported.messages, ...s.messages],
      activeProjectId: imported.projects[0]?.id ?? s.activeProjectId,
      selectedNodeId: null,
      focusedNodeId: null,
    }));
  },

  resetToSample: () => {
    clearAllData();
    saveSecrets({});
    const fresh = loadData();
    set({
      ...fresh,
      secrets: {},
      selectedNodeId: null,
      focusedNodeId: null,
      revealNodeId: null,
      statusFilter: 'all',
    });
  },
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;

useStore.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveData({
      version: 1,
      projects: state.projects,
      nodes: state.nodes,
      edges: state.edges,
      messages: state.messages,
      settings: state.settings,
      activeProjectId: state.activeProjectId,
    });
  }, 350);
});
