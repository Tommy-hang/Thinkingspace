import { create } from 'zustand';
import type {
  BranchAnchor,
  BranchIntent,
  ContextSettings,
  GraphEdge,
  HistorySnapshot,
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
import { getVisibleNodes } from '../lib/tree';
import { intentToEdgeType } from '../lib/branchIntent';
import { generateTitle, localSummary } from '../lib/title';
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
  nodeMenuId: string | null;
  nodeMenuAnchor: { x: number; y: number } | null;
  /** 打开聚焦视图后需要滚动定位到的消息 */
  focusMessageId: string | null;
  helpOpen: boolean;
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

interface Actions {
  setActiveProject: (id: string) => void;
  createProject: (title: string) => string;
  renameProject: (id: string, title: string) => void;
  updateProjectSummary: (id: string, summary: string) => void;
  deleteProject: (id: string) => void;

  createRootNode: () => string;
  createBranch: (
    parentId: string,
    anchor?: Partial<BranchAnchor>,
    title?: string,
    intent?: BranchIntent,
  ) => string;
  updateNode: (id: string, patch: Partial<Pick<TopicNode, 'title' | 'summary' | 'status'>>) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  applyAutoLayout: () => void;

  toggleCollapse: (id: string) => void;
  togglePin: (id: string) => void;
  renameNode: (id: string, title: string) => void;
  applyAutoTitle: (id: string, title: string, summary?: string) => void;
  hideNode: (id: string) => void;
  hideChildren: (id: string) => void;
  unhideNode: (id: string) => void;
  showAllHidden: () => void;

  undo: () => void;
  redo: () => void;
  beginNodeDrag: (id: string) => void;
  endNodeDrag: (id: string) => void;

  addEdge: (source: string, target: string, type?: GraphEdge['type']) => void;
  removeEdge: (id: string) => void;

  sendMessage: (nodeId: string, text: string) => Promise<void>;
  regenerate: (nodeId: string) => Promise<void>;
  editUserMessage: (nodeId: string, messageId: string, content: string) => Promise<void>;
  _generate: (nodeId: string, question: string, addUserMessage: boolean) => Promise<void>;
  stopStreaming: (nodeId: string) => void;

  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  focusNodeAt: (id: string, messageId: string) => void;
  clearFocusMessage: () => void;
  revealNode: (id: string) => void;
  clearReveal: () => void;
  openNodeMenu: (id: string | null, anchor?: { x: number; y: number } | null) => void;
  setHelpOpen: (open: boolean) => void;
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

export type StoreState = Omit<PersistedData, 'recentNodeIds'> & { recentNodeIds: string[] } &
  UIState & { secrets: Secrets; history: HistoryState } & Actions;

const initial = loadData();

const controllers = new Map<string, AbortController>();

const HISTORY_LIMIT = 60;

/** 拖动开始时的快照，拖动结束后才真正进入历史，避免一次拖动产生几十条记录 */
let dragStart: { snapshot: HistorySnapshot; position: { x: number; y: number } } | null = null;

let lastHistoryKey: string | null = null;
let lastHistoryAt = 0;

function snapshotOf(s: StoreState): HistorySnapshot {
  return {
    projects: s.projects,
    nodes: s.nodes,
    edges: s.edges,
    messages: s.messages,
    activeProjectId: s.activeProjectId,
  };
}

function pushHistory(coalesceKey?: string) {
  const s = useStore.getState();
  const now = Date.now();
  if (coalesceKey && lastHistoryKey === coalesceKey && now - lastHistoryAt < 1200) {
    lastHistoryAt = now;
    return;
  }
  lastHistoryKey = coalesceKey ?? null;
  lastHistoryAt = now;

  const past = [...s.history.past, snapshotOf(s)];
  if (past.length > HISTORY_LIMIT) past.shift();
  useStore.setState({ history: { past, future: [] } });
}

function resetHistoryCoalesce() {
  lastHistoryKey = null;
  lastHistoryAt = 0;
}

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

export const useStore = create<StoreState>((set, get) => ({
  ...initial,
  recentNodeIds: initial.recentNodeIds ?? [],
  secrets: loadSecrets(),
  history: { past: [], future: [] },

  selectedNodeId: null,
  focusedNodeId: null,
  revealNodeId: null,
  nodeMenuId: null,
  nodeMenuAnchor: null,
  focusMessageId: null,
  helpOpen: false,
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
    pushHistory();
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

  renameProject: (id, title) => {
    pushHistory(`project-title:${id}`);
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, title, updatedAt: Date.now() } : p,
      ),
    }));
  },

  updateProjectSummary: (id, summary) => {
    pushHistory(`project-summary:${id}`);
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, summary, updatedAt: Date.now() } : p,
      ),
    }));
  },

  deleteProject: (id) => {
    pushHistory();
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
    });
  },

  createRootNode: () => {
    pushHistory();
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

  createBranch: (parentId, anchor, title, intent) => {
    const s = get();
    const parent = s.nodes.find((n) => n.id === parentId);
    if (!parent) return '';
    pushHistory();
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
      intent,
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
      type: intent ? intentToEdgeType(intent) : 'branch',
      createdAt: now,
    };
    set((state) => ({
      nodes: [...state.nodes, node],
      edges: [...state.edges, edge],
      selectedNodeId: node.id,
    }));
    return node.id;
  },

  updateNode: (id, patch) => {
    pushHistory(`node:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    }));
  },

  moveNode: (id, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position, updatedAt: Date.now() } : n)),
    })),

  deleteNode: (id) => {
    pushHistory();
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
    });
  },

  applyAutoLayout: () => {
    pushHistory();
    set((s) => {
      if (!s.activeProjectId) return {};
      const projectNodes = s.nodes.filter((n) => n.projectId === s.activeProjectId);
      // 只排列当前可见的节点，被折叠的后代保持原位置，展开后不会错乱
      const positions = layoutTree(getVisibleNodes(projectNodes));
      return {
        nodes: s.nodes.map((n) =>
          positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n,
        ),
      };
    });
  },

  toggleCollapse: (id) => {
    pushHistory(`collapse:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, collapsed: !n.collapsed, updatedAt: Date.now() } : n,
      ),
    }));
  },

  togglePin: (id) => {
    pushHistory(`pin:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n,
      ),
    }));
  },

  renameNode: (id, title) => {
    const next = title.trim();
    if (!next) return;
    pushHistory(`rename:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, title: next, titleLocked: true, updatedAt: Date.now() } : n,
      ),
    }));
  },

  /** 由系统自动写入标题（不计入撤销历史，属于「提问」这一步的一部分） */
  applyAutoTitle: (id, title, summary) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && !n.titleLocked
          ? {
              ...n,
              title: title || n.title,
              summary: summary ?? n.summary,
              updatedAt: Date.now(),
            }
          : n,
      ),
    })),

  hideNode: (id) => {
    pushHistory(`hide:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, hidden: true, updatedAt: Date.now() } : n)),
    }));
  },

  hideChildren: (id) => {
    pushHistory(`hideChildren:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.parentId === id ? { ...n, hidden: true, updatedAt: Date.now() } : n,
      ),
    }));
  },

  unhideNode: (id) => {
    pushHistory(`unhide:${id}`);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, hidden: false, updatedAt: Date.now() } : n,
      ),
    }));
  },

  showAllHidden: () => {
    pushHistory();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.hidden ? { ...n, hidden: false } : n)),
    }));
  },

  undo: () => {
    const s = get();
    if (s.history.past.length === 0) return;
    const past = [...s.history.past];
    const prev = past.pop()!;
    const future = [snapshotOf(s), ...s.history.future].slice(0, HISTORY_LIMIT);
    resetHistoryCoalesce();
    const ids = new Set(prev.nodes.map((n) => n.id));
    set({
      ...prev,
      history: { past, future },
      selectedNodeId: s.selectedNodeId && ids.has(s.selectedNodeId) ? s.selectedNodeId : null,
      focusedNodeId: s.focusedNodeId && ids.has(s.focusedNodeId) ? s.focusedNodeId : null,
      revealNodeId: null,
    });
  },

  redo: () => {
    const s = get();
    if (s.history.future.length === 0) return;
    const future = [...s.history.future];
    const next = future.shift()!;
    const past = [...s.history.past, snapshotOf(s)].slice(-HISTORY_LIMIT);
    resetHistoryCoalesce();
    const ids = new Set(next.nodes.map((n) => n.id));
    set({
      ...next,
      history: { past, future },
      selectedNodeId: s.selectedNodeId && ids.has(s.selectedNodeId) ? s.selectedNodeId : null,
      focusedNodeId: s.focusedNodeId && ids.has(s.focusedNodeId) ? s.focusedNodeId : null,
      revealNodeId: null,
    });
  },

  beginNodeDrag: (id) => {
    const s = get();
    const node = s.nodes.find((n) => n.id === id);
    if (!node) return;
    dragStart = { snapshot: snapshotOf(s), position: { ...node.position } };
  },

  endNodeDrag: (id) => {
    if (!dragStart) return;
    const s = get();
    const node = s.nodes.find((n) => n.id === id);
    const moved =
      node &&
      (node.position.x !== dragStart.position.x || node.position.y !== dragStart.position.y);
    if (moved) {
      const past = [...s.history.past, dragStart.snapshot];
      if (past.length > HISTORY_LIMIT) past.shift();
      set({ history: { past, future: [] } });
      resetHistoryCoalesce();
    }
    dragStart = null;
  },

  addEdge: (source, target, type = 'branch') => {
    pushHistory();
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
    });
  },

  removeEdge: (id) => {
    pushHistory();
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
  },

  sendMessage: async (nodeId, text) => {
    const question = text.trim();
    if (!question) return;
    pushHistory();
    await get()._generate(nodeId, question, true);
  },

  regenerate: async (nodeId) => {
    const s = get();
    const own = s.messages.filter((m) => m.nodeId === nodeId);
    const lastUser = [...own].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;

    const keep = new Set<string>();
    for (const m of own) {
      keep.add(m.id);
      if (m.id === lastUser.id) break;
    }
    pushHistory();
    set((state) => ({
      messages: state.messages.filter((m) => m.nodeId !== nodeId || keep.has(m.id)),
    }));
    await get()._generate(nodeId, lastUser.content, false);
  },

  editUserMessage: async (nodeId, messageId, content) => {
    const text = content.trim();
    if (!text) return;

    const s = get();
    const own = s.messages.filter((m) => m.nodeId === nodeId);
    const lastUser = [...own].reverse().find((m) => m.role === 'user');
    // 只允许编辑最近一次提问，避免破坏后续对话的上下文
    if (!lastUser || lastUser.id !== messageId) return;

    const keep = new Set<string>();
    for (const m of own) {
      keep.add(m.id);
      if (m.id === lastUser.id) break;
    }
    pushHistory();
    set((state) => ({
      messages: state.messages
        .filter((m) => m.nodeId !== nodeId || keep.has(m.id))
        .map((m) => (m.id === messageId ? { ...m, content: text } : m)),
    }));
    await get()._generate(nodeId, text, false);
  },

  _generate: async (nodeId, question, addUserMessage) => {
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
    const isFirstTurn = !state.messages.some((m) => m.nodeId === nodeId);
    const userMessage: Message | null = addUserMessage
      ? { id: uid('m_'), nodeId, role: 'user', content: question, createdAt: now }
      : null;
    const assistantMessage: Message = {
      id: uid('m_'),
      nodeId,
      role: 'assistant',
      content: '',
      createdAt: now,
      pending: true,
    };

    set((s) => ({
      messages: [...s.messages, ...(userMessage ? [userMessage] : []), assistantMessage],
      streamingNodeId: nodeId,
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
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

      // 第一次对话结束后，根据对话的「核心知识点」自动生成标题与摘要
      if (isFirstTurn) {
        const full = get().messages.find((m) => m.id === assistantMessage.id)?.content ?? '';
        if (full.trim()) {
          void generateTitle({
            provider,
            apiKey: get().secrets[provider.id] ?? '',
            question,
            answer: full,
          }).then((title) => {
            const current = get().nodes.find((n) => n.id === nodeId);
            if (!current || current.titleLocked) return;
            get().applyAutoTitle(nodeId, title, localSummary(full) || undefined);
          });
        }
      }
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

  focusNode: (id) => {
    set({ focusedNodeId: id });
    if (id) {
      set((s) => ({
        recentNodeIds: [id, ...s.recentNodeIds.filter((x) => x !== id)].slice(0, 15),
      }));
    }
  },

  revealNode: (id) => {
    set((s) => ({
      selectedNodeId: id,
      revealNodeId: id,
      nodeMenuId: null,
      recentNodeIds: [id, ...s.recentNodeIds.filter((x) => x !== id)].slice(0, 15),
    }));
  },

  focusNodeAt: (id, messageId) =>
    set((s) => ({
      focusedNodeId: id,
      focusMessageId: messageId,
      nodeMenuId: null,
      nodeMenuAnchor: null,
      recentNodeIds: [id, ...s.recentNodeIds.filter((x) => x !== id)].slice(0, 15),
    })),

  clearFocusMessage: () => set({ focusMessageId: null }),

  clearReveal: () => set({ revealNodeId: null }),
  openNodeMenu: (id, anchor) =>
    set({ nodeMenuId: id, nodeMenuAnchor: anchor ?? null }),
  setHelpOpen: (open) => set({ helpOpen: open }),
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
    pushHistory();
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
      recentNodeIds: [],
      secrets: {},
      history: { past: [], future: [] },
      selectedNodeId: null,
      focusedNodeId: null,
      revealNodeId: null,
      nodeMenuId: null,
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
      recentNodeIds: state.recentNodeIds,
    });
  }, 350);
});
