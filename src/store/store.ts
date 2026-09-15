import { create } from 'zustand';
import type {
  BranchAnchor,
  BranchIntent,
  BranchSuggestion,
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
import { generateDigest, generateInsight, generateSuggestions } from '../lib/reasoning';
import { generateKnowledgeMap, type KnowledgeSourceItem } from '../lib/knowledgeMap';
import { cloudConfigured } from '../lib/cloud/client';
import {
  getCurrentUser,
  onAuthChange,
  sendPasswordReset,
  signInWithPassword,
  signOutCloud,
  signUpWithPassword,
  type CloudUser,
} from '../lib/cloud/auth';
import {
  fullSync,
  hasCloudSession,
  pushDirty,
  removeRemoteProject,
  resetCloudEngine,
  syncSettingsToCloud,
  type WorkspaceSnapshot,
} from '../lib/cloud/engine';
import {
  loadData,
  loadSecrets,
  loadUiPrefs,
  saveData,
  saveSecrets,
  saveUiPrefs,
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
  knowledgeOpen: boolean;
  knowledgeProgress: { phase: 'summaries' | 'map'; current: number; total: number } | null;

  cloudUser: CloudUser | null;
  cloudStatus: 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'error';
  cloudNotice: string | null;
  authOpen: boolean;
  guestBannerDismissed: boolean;
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
  applyAutoTitle: (id: string, title?: string, summary?: string) => void;
  refreshSummary: (id: string) => Promise<void>;
  mergeInsights: (id: string) => Promise<void>;
  setSuggestions: (id: string, forMessageId: string, list: BranchSuggestion[]) => void;
  generateSuggestionsFor: (id: string) => Promise<void>;
  addOpenQuestion: (text: string, sourceNodeId?: string, sourceMessageId?: string) => void;
  toggleOpenQuestion: (questionId: string) => void;
  removeOpenQuestion: (questionId: string) => void;
  createChildBranch: (parentId: string) => string;
  deleteChildren: (parentId: string) => void;
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

  sendMessage: (nodeId: string, text: string, mentions?: string[]) => Promise<void>;
  regenerate: (nodeId: string) => Promise<void>;
  editUserMessage: (nodeId: string, messageId: string, content: string) => Promise<void>;
  _generate: (
    nodeId: string,
    question: string,
    addUserMessage: boolean,
    mentions?: string[],
  ) => Promise<void>;
  stopStreaming: (nodeId: string) => void;

  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  focusNodeAt: (id: string, messageId?: string) => void;
  clearFocusMessage: () => void;
  revealNode: (id: string) => void;
  clearReveal: () => void;
  openNodeMenu: (id: string | null, anchor?: { x: number; y: number } | null) => void;
  setHelpOpen: (open: boolean) => void;
  setKnowledgeOpen: (open: boolean) => void;
  locateNode: (id: string) => void;
  buildKnowledgeMap: () => Promise<void>;

  setAuthOpen: (open: boolean) => void;
  dismissGuestBanner: () => void;
  initCloud: () => Promise<void>;
  cloudSignUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>;
  cloudSignIn: (email: string, password: string) => Promise<void>;
  cloudSignOut: () => Promise<void>;
  cloudSyncNow: () => Promise<void>;
  cloudSendReset: (email: string) => Promise<void>;
  setCloudNotice: (notice: string | null) => void;
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

/* ============================ 云端同步（薄层，业务代码无感知） ============================ */

function localSnapshot(): WorkspaceSnapshot {
  const s = useStore.getState();
  return {
    projects: s.projects,
    nodes: s.nodes,
    edges: s.edges,
    messages: s.messages,
    settings: s.settings,
  };
}

async function performFullSync(): Promise<void> {
  useStore.setState({ cloudStatus: 'syncing', cloudNotice: null });
  try {
    const outcome = await fullSync(localSnapshot());
    useStore.setState({
      projects: outcome.snapshot.projects,
      nodes: outcome.snapshot.nodes,
      edges: outcome.snapshot.edges,
      messages: outcome.snapshot.messages,
      settings: outcome.snapshot.settings,
      cloudStatus: 'synced',
      cloudNotice: outcome.warnings.length > 0 ? outcome.warnings.join(' ') : null,
    });
  } catch (err) {
    useStore.setState({
      cloudStatus: 'error',
      cloudNotice: err instanceof Error ? err.message : String(err),
    });
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
let settingsDirty = false;

function schedulePush(settingsChanged: boolean): void {
  if (!hasCloudSession()) return;
  if (settingsChanged) settingsDirty = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushPush();
  }, 900);
}

async function flushPush(): Promise<void> {
  if (!hasCloudSession() || pushInFlight) return;
  pushInFlight = true;
  useStore.setState({ cloudStatus: 'syncing' });
  try {
    const snapshot = localSnapshot();
    const result = await pushDirty(snapshot);
    if (settingsDirty) {
      await syncSettingsToCloud(snapshot.settings);
      settingsDirty = false;
    }
    useStore.setState({
      cloudStatus: 'synced',
      cloudNotice: result.warnings.length > 0 ? result.warnings.join(' ') : null,
    });
  } catch (err) {
    useStore.setState({
      cloudStatus: 'error',
      cloudNotice: err instanceof Error ? err.message : String(err),
    });
  } finally {
    pushInFlight = false;
  }
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
  knowledgeOpen: false,
  knowledgeProgress: null,
  cloudUser: null,
  cloudStatus: cloudConfigured ? 'signed-out' : 'disabled',
  cloudNotice: null,
  authOpen: false,
  guestBannerDismissed: loadUiPrefs().guestBannerDismissed ?? false,
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
    if (hasCloudSession()) {
      void removeRemoteProject(id).catch(() => {
        /* 云端删除失败时，本地仍然删除；下次同步会再试 */
      });
    }
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

  /** 从菜单直接新建一个子分支并进入它 */
  createChildBranch: (parentId) => {
    const parent = get().nodes.find((n) => n.id === parentId);
    const id = get().createBranch(parentId, {
      sourceNodeId: parentId,
      parentContextSummary: parent?.summary,
    });
    if (id) get().focusNode(id);
    return id;
  },

  /** 删除该节点下的所有子分支（含各自的后代） */
  deleteChildren: (parentId) => {
    pushHistory();
    set((s) => {
      const children = s.nodes.filter((n) => n.parentId === parentId).map((n) => n.id);
      if (children.length === 0) return {};
      const doomed = new Set<string>();
      for (const childId of children) {
        for (const id of collectSubtree(s.nodes, childId)) doomed.add(id);
      }
      return {
        nodes: s.nodes.filter((n) => !doomed.has(n.id)),
        edges: s.edges.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)),
        messages: s.messages.filter((m) => !doomed.has(m.nodeId)),
        selectedNodeId:
          s.selectedNodeId && doomed.has(s.selectedNodeId) ? null : s.selectedNodeId,
        focusedNodeId:
          s.focusedNodeId && doomed.has(s.focusedNodeId) ? null : s.focusedNodeId,
      };
    });
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

  /** 由系统自动写入标题 / 当前理解（不计入撤销历史，属于「提问」这一步的一部分） */
  applyAutoTitle: (id, title, summary) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id) return n;
        const nextTitle = n.titleLocked ? n.title : title || n.title;
        return {
          ...n,
          title: nextTitle,
          summary: summary ?? n.summary,
          summaryUpdatedAt: summary ? Date.now() : n.summaryUpdatedAt,
          updatedAt: Date.now(),
        };
      }),
    })),

  /** 根据整段对话重新生成「当前理解」 */
  refreshSummary: async (id) => {
    const s = get();
    const node = s.nodes.find((n) => n.id === id);
    const project = s.projects.find((p) => p.id === node?.projectId);
    const provider = s.settings.providers.find((p) => p.id === s.settings.activeProviderId);
    if (!node || !project || !provider) return;

    const own = s.messages.filter((m) => m.nodeId === id && m.content.trim());
    if (own.length === 0) return;

    const firstUser = own.find((m) => m.role === 'user');
    const lastAssistant = [...own].reverse().find((m) => m.role === 'assistant');

    const transcript = own
      .slice(-24)
      .map((m) => `${m.role === 'user' ? '我' : 'AI'}：${m.content}`)
      .join('\n\n');

    const digest = await generateDigest({
      provider,
      apiKey: get().secrets[provider.id] ?? '',
      content: transcript,
      fallbackQuestion: firstUser?.content ?? node.title,
      fallbackAnswer: lastAssistant?.content ?? own[own.length - 1].content,
    });

    const current = get().nodes.find((n) => n.id === id);
    if (!current) return;
    get().applyAutoTitle(id, current.titleLocked ? undefined : digest.title, digest.summary);
  },

  /** Merge Insights：把子分支的探索综合成父主题更高层的理解 */
  mergeInsights: async (id) => {
    const s = get();
    const node = s.nodes.find((n) => n.id === id);
    const provider = s.settings.providers.find((p) => p.id === s.settings.activeProviderId);
    if (!node || !provider) return;

    const children = s.nodes.filter((n) => n.parentId === id);
    if (children.length === 0) return;

    const insight = await generateInsight({
      provider,
      apiKey: get().secrets[provider.id] ?? '',
      topicTitle: node.title,
      topicSummary: node.summary,
      children,
    });
    if (!insight.trim()) return;

    pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, insight, insightUpdatedAt: Date.now() } : n,
      ),
    }));
  },

  setSuggestions: (id, forMessageId, list) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, suggestions: list, suggestionsFor: forMessageId } : n,
      ),
    })),

  generateSuggestionsFor: async (id) => {
    const s = get();
    const node = s.nodes.find((n) => n.id === id);
    const provider = s.settings.providers.find((p) => p.id === s.settings.activeProviderId);
    if (!node || !provider) return;

    const own = s.messages.filter((m) => m.nodeId === id && m.content.trim());
    const lastAssistant = [...own].reverse().find((m) => m.role === 'assistant');
    const lastUser = [...own].reverse().find((m) => m.role === 'user');
    if (!lastAssistant || !lastUser) return;

    const list = await generateSuggestions({
      provider,
      apiKey: get().secrets[provider.id] ?? '',
      question: lastUser.content,
      answer: lastAssistant.content,
    });
    get().setSuggestions(id, lastAssistant.id, list);
  },

  /** 待解决问题属于整个项目，所有卡片看到的是同一份 */
  addOpenQuestion: (text, sourceNodeId, sourceMessageId) => {
    const clean = text.trim();
    if (!clean) return;
    const projectId = get().activeProjectId;
    if (!projectId) return;
    pushHistory();
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              openQuestions: [
                ...(p.openQuestions ?? []),
                {
                  id: uid('q_'),
                  text: clean,
                  sourceNodeId,
                  sourceMessageId,
                  createdAt: Date.now(),
                },
              ],
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
  },

  toggleOpenQuestion: (questionId) => {
    const projectId = get().activeProjectId;
    if (!projectId) return;
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              openQuestions: (p.openQuestions ?? []).map((q) =>
                q.id === questionId ? { ...q, resolved: !q.resolved } : q,
              ),
            }
          : p,
      ),
    }));
  },

  removeOpenQuestion: (questionId) => {
    const projectId = get().activeProjectId;
    if (!projectId) return;
    pushHistory();
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              openQuestions: (p.openQuestions ?? []).filter((q) => q.id !== questionId),
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
  },

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

  sendMessage: async (nodeId, text, mentions) => {
    const question = text.trim();
    if (!question) return;
    pushHistory();
    await get()._generate(nodeId, question, true, mentions);
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
    await get()._generate(nodeId, lastUser.content, false, lastUser.mentions);
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

  _generate: async (nodeId, question, addUserMessage, mentions) => {
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
      ? {
          id: uid('m_'),
          nodeId,
          role: 'user',
          content: question,
          mentions: mentions && mentions.length > 0 ? mentions : undefined,
          createdAt: now,
        }
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
      mentionedNodeIds: mentions,
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

      const full = get().messages.find((m) => m.id === assistantMessage.id)?.content ?? '';
      const apiKey = get().secrets[provider.id] ?? '';

      // 第一次对话结束后：根据「核心知识点」生成标题与「当前理解」
      if (isFirstTurn && full.trim()) {
        void generateDigest({
          provider,
          apiKey,
          content: `【提问】\n${question}\n\n【回答】\n${full}`,
          fallbackQuestion: question,
          fallbackAnswer: full,
        }).then((digest) => {
          const current = get().nodes.find((n) => n.id === nodeId);
          if (!current) return;
          get().applyAutoTitle(
            nodeId,
            current.titleLocked ? undefined : digest.title,
            digest.summary || undefined,
          );
        });
      }

      // 每次回答后，让 AI 提议 2-4 个探索方向（用户可选择忽略）
      if (full.trim() && state.settings.reasoning.suggestBranches) {
        void generateSuggestions({ provider, apiKey, question, answer: full }).then((list) => {
          if (list.length > 0) get().setSuggestions(nodeId, assistantMessage.id, list);
        });
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
      focusMessageId: messageId ?? null,
      nodeMenuId: null,
      nodeMenuAnchor: null,
      recentNodeIds: [id, ...s.recentNodeIds.filter((x) => x !== id)].slice(0, 15),
    })),

  clearFocusMessage: () => set({ focusMessageId: null }),

  clearReveal: () => set({ revealNodeId: null }),
  openNodeMenu: (id, anchor) =>
    set({ nodeMenuId: id, nodeMenuAnchor: anchor ?? null }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setKnowledgeOpen: (open) => set({ knowledgeOpen: open }),

  setAuthOpen: (open) => set({ authOpen: open }),
  setCloudNotice: (notice) => set({ cloudNotice: notice }),
  dismissGuestBanner: () => {
    saveUiPrefs({ ...loadUiPrefs(), guestBannerDismissed: true });
    set({ guestBannerDismissed: true });
  },

  initCloud: async () => {
    if (!cloudConfigured) {
      set({ cloudStatus: 'disabled' });
      return;
    }
    set({ cloudStatus: 'signed-out' });

    try {
      const user = await getCurrentUser();
      if (user) {
        resetCloudEngine(user.id);
        set({ cloudUser: user });
        await performFullSync();
      }
    } catch {
      set({ cloudStatus: 'signed-out' });
    }

    // 令牌失效或登出时回到未登录状态
    onAuthChange((next) => {
      if (!next) {
        resetCloudEngine(null);
        set({ cloudUser: null, cloudStatus: 'signed-out' });
      }
    });
  },

  cloudSignUp: async (email, password) => {
    set({ cloudStatus: 'syncing', cloudNotice: null });
    try {
      const result = await signUpWithPassword(email, password);
      if (result.user) {
        resetCloudEngine(result.user.id);
        set({ cloudUser: result.user });
        await performFullSync();
      } else {
        set({ cloudStatus: 'signed-out' });
      }
      return { needsEmailConfirm: result.needsEmailConfirm };
    } catch (err) {
      set({
        cloudStatus: 'error',
        cloudNotice: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },

  cloudSignIn: async (email, password) => {
    set({ cloudStatus: 'syncing', cloudNotice: null });
    try {
      const user = await signInWithPassword(email, password);
      resetCloudEngine(user.id);
      set({ cloudUser: user });
      await performFullSync();
    } catch (err) {
      set({
        cloudStatus: 'error',
        cloudNotice: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },

  cloudSignOut: async () => {
    try {
      await signOutCloud();
    } catch {
      /* 忽略 */
    }
    resetCloudEngine(null);
    set({ cloudUser: null, cloudStatus: 'signed-out', cloudNotice: null });
  },

  cloudSyncNow: async () => {
    if (!hasCloudSession()) return;
    await performFullSync();
  },

  cloudSendReset: async (email) => {
    await sendPasswordReset(email);
  },

  locateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    if (node.hidden) get().unhideNode(id);
    get().revealNode(id);
  },

  /**
   * 生成项目级知识地图：
   * 1) 先让每张卡片更新一次「当前理解」（不读取全部对话）
   * 2) 再根据所有「当前理解」之间的知识点关系构建思维导图
   */
  buildKnowledgeMap: async () => {
    const s = get();
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    const provider = s.settings.providers.find((p) => p.id === s.settings.activeProviderId);
    if (!project || !provider) return;

    const projectNodes = s.nodes.filter((n) => n.projectId === project.id && !n.hidden);
    const withContent = projectNodes.filter((n) =>
      s.messages.some((m) => m.nodeId === n.id && m.content.trim()),
    );

    set({ knowledgeProgress: { phase: 'summaries', current: 0, total: withContent.length } });
    for (let i = 0; i < withContent.length; i += 1) {
      set({
        knowledgeProgress: { phase: 'summaries', current: i, total: withContent.length },
      });
      await get().refreshSummary(withContent[i].id);
    }
    set({
      knowledgeProgress: {
        phase: 'summaries',
        current: withContent.length,
        total: withContent.length,
      },
    });

    set({ knowledgeProgress: { phase: 'map', current: 0, total: 1 } });
    const fresh = get();
    const items: KnowledgeSourceItem[] = fresh.nodes
      .filter((n) => n.projectId === project.id && !n.hidden)
      .map((n) => ({
        id: n.id,
        title: n.title,
        summary: n.summary || n.insight || '',
      }))
      .filter((item) => item.summary.trim().length > 0);

    const map = await generateKnowledgeMap({
      provider,
      apiKey: fresh.secrets[provider.id] ?? '',
      projectTitle: project.title,
      items,
    });

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id ? { ...p, knowledgeMap: map, updatedAt: Date.now() } : p,
      ),
      knowledgeProgress: null,
    }));
  },
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

/** 只在这些「数据切片」真的变化时才触发保存与云端同步 */
const lastSaved = {
  projects: null as unknown,
  nodes: null as unknown,
  edges: null as unknown,
  messages: null as unknown,
  settings: null as unknown,
};

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

  const changed =
    state.projects !== lastSaved.projects ||
    state.nodes !== lastSaved.nodes ||
    state.edges !== lastSaved.edges ||
    state.messages !== lastSaved.messages;
  const settingsChanged = state.settings !== lastSaved.settings;

  if (changed || settingsChanged) {
    lastSaved.projects = state.projects;
    lastSaved.nodes = state.nodes;
    lastSaved.edges = state.edges;
    lastSaved.messages = state.messages;
    lastSaved.settings = state.settings;
    schedulePush(settingsChanged);
  }
});
