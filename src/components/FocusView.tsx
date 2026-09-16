import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import {
  NODE_STATUS,
  type Message,
  type ModelPreset,
  type NodeStatus,
  type ThinkingEffort,
  type TopicNode,
} from '../types';
import { ancestorPath } from '../lib/ai/contextBuilder';
import { Popover, MenuItem } from './Popover';
import { Markdown } from './Markdown';
import { ContextLens } from './ContextLens';
import {
  IconBranch,
  IconCheck,
  IconChevronLeft,
  IconDownload,
  IconEdit,
  IconGlobe,
  IconHistory,
  IconLayers,
  IconLink,
  IconMore,
  IconPin,
  IconPlus,
  IconRefresh,
  IconSend,
  IconSpark,
  IconStop,
  IconTrash,
  IconX,
} from './icons';
import { downloadMarkdown, exportBranchMarkdown } from '../lib/branchExport';
import { diffSentences, diffSummary } from '../lib/diff';
import { buildNodeUrl, copyText } from '../lib/link';
import { extractMentions, firstSentence } from '../lib/mention';
import {
  INTENT_META,
  INTENT_ORDER,
  buildIntentQuestion,
  intentLabel,
} from '../lib/branchIntent';
import type { BranchIntent, BranchSuggestion } from '../types';

interface FocusViewProps {
  nodeId: string;
  originRect: DOMRect | null;
  onClose: () => void;
}

interface SelectionState {
  text: string;
  x: number;
  y: number;
}

const EFFORT_LABEL: Record<ThinkingEffort, string> = {
  low: '低',
  high: '高',
  max: '最高',
};

function ThinkingBlock({ reasoning, pending }: { reasoning: string; pending?: boolean }) {
  const [open, setOpen] = useState(Boolean(pending));

  useEffect(() => {
    setOpen(Boolean(pending));
  }, [pending]);

  return (
    <div
      className="mb-3 overflow-hidden rounded-xl"
      style={{
        border: '1px solid var(--border)',
        background: 'var(--panel-2)',
      }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-[12px] transition-colors"
        style={{ color: 'var(--muted)' }}
        onClick={() => setOpen((o) => !o)}
      >
        <IconSpark width={13} height={13} />
        <span>{pending ? '正在深度思考…' : '已深度思考'}</span>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--faint)' }}>
          {open ? '收起' : '展开'}
        </span>
      </button>
      {open && (
        <div
          className="ts-scroll ts-markdown max-h-[320px] overflow-y-auto px-3 pb-3 text-[12.5px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)', paddingTop: 10 }}
        >
          <Markdown content={reasoning} />
        </div>
      )}
    </div>
  );
}

function SourceList({ sources }: { sources: NonNullable<Message['sources']> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
      <button
        className="flex items-center gap-1.5 text-[11.5px] font-medium"
        style={{ color: 'var(--muted)' }}
        onClick={() => setOpen((o) => !o)}
      >
        <IconGlobe width={12} height={12} />
        参考来源 · {sources.length}
        <span style={{ color: 'var(--faint)' }}>{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {sources.map((s, i) => (
            <a
              key={`${s.url}-${i}`}
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-[11.5px] hover:underline"
              style={{ color: 'var(--accent)' }}
              title={s.title}
            >
              [{i + 1}] {s.title || s.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** 新的「当前理解」待确认：展示句子级 +/− 差异，用户采纳后才成为新版本 */
function SummaryReview({
  current,
  proposed,
  onAccept,
  onDiscard,
}: {
  current: string;
  proposed: string;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const parts = diffSentences(current, proposed);
  const { added, removed } = diffSummary(parts);

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 26%, transparent)',
      }}
    >
      <div
        className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium"
        style={{ color: 'var(--accent)' }}
      >
        <IconSpark width={12} height={12} />
        新的「当前理解」待确认
        <span className="ml-auto text-[10.5px]" style={{ color: 'var(--faint)' }}>
          +{added} / −{removed}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 text-[12.5px] leading-relaxed">
        {parts.map((p, i) => (
          <div
            key={i}
            style={{
              color:
                p.type === 'add' ? '#16a34a' : p.type === 'remove' ? '#dc2626' : 'var(--muted)',
              textDecoration: p.type === 'remove' ? 'line-through' : 'none',
              opacity: p.type === 'same' ? 0.72 : 1,
            }}
          >
            <span style={{ opacity: 0.7 }}>
              {p.type === 'add' ? '+ ' : p.type === 'remove' ? '− ' : '　'}
            </span>
            {p.text}
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex justify-end gap-2">
        <button className="btn btn-ghost !px-2 !py-0.5 !text-[11.5px]" onClick={onDiscard}>
          放弃
        </button>
        <button className="btn btn-primary !px-2.5 !py-0.5 !text-[11.5px]" onClick={onAccept}>
          采纳为新版本
        </button>
      </div>
    </div>
  );
}

/** 综合节点：来源、未解决矛盾，以及「来源更新后可能过期」的提示 */
function SynthesisBlock({
  node,
  nodes,
  busy,
  onRefresh,
  onOpenSource,
}: {
  node: TopicNode;
  nodes: TopicNode[];
  busy: boolean;
  onRefresh: () => void;
  onOpenSource: (id: string) => void;
}) {
  const syn = node.synthesis;
  if (!syn) return null;

  const stale = syn.sources.filter((s) => {
    const cur = nodes.find((n) => n.id === s.id);
    return !cur || cur.updatedAt > s.updatedAt;
  });

  return (
    <div
      className="mt-3 rounded-lg p-2.5"
      style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
    >
      <div
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium"
        style={{ color: 'var(--muted)' }}
      >
        <IconLayers width={11} height={11} />
        综合自 {syn.sources.length} 个主题
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {syn.sources.map((s) => (
          <button
            key={s.id}
            className="chip"
            title="点击跳转到这个主题"
            onClick={() => onOpenSource(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>

      {syn.contradictions.trim() && (
        <div
          className="mb-2 rounded-lg p-2 text-[12px] leading-relaxed"
          style={{
            background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
            border: '1px solid color-mix(in srgb, #f59e0b 34%, transparent)',
            color: 'var(--text)',
          }}
        >
          <div className="mb-0.5 text-[10.5px] font-medium" style={{ color: '#b45309' }}>
            尚未解决的矛盾
          </div>
          {syn.contradictions}
        </div>
      )}

      {stale.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1.5 text-[11px]"
          style={{ color: '#b45309' }}
        >
          ⚠ 有 {stale.length} 个来源已更新，这个综合可能已过期
          <button
            className="btn btn-ghost !px-1.5 !py-0 !text-[11px]"
            style={{ color: '#b45309' }}
            disabled={busy}
            onClick={onRefresh}
          >
            {busy ? '重新综合中…' : '重新综合'}
          </button>
        </div>
      ) : (
        <button
          className="btn btn-ghost !px-1.5 !py-0 !text-[11px]"
          style={{ color: 'var(--faint)' }}
          disabled={busy}
          onClick={onRefresh}
        >
          {busy ? '重新综合中…' : '重新综合'}
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message, searching }: { message: Message; searching?: boolean }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={isUser ? 'ts-prose' : 'ts-markdown-host'}
        style={{
          maxWidth: 'min(760px, 92%)',
          borderRadius: 16,
          padding: '12px 16px',
          fontSize: 14,
          background: isUser ? 'var(--accent)' : 'var(--panel)',
          color: isUser ? 'var(--accent-text)' : 'var(--text)',
          border: isUser ? '1px solid transparent' : '1px solid var(--border)',
          borderColor: message.error ? '#dc2626' : undefined,
        }}
      >
        {!isUser && message.reasoning ? (
          <ThinkingBlock reasoning={message.reasoning} pending={message.pending} />
        ) : null}

        {isUser ? (
          message.content
        ) : message.content ? (
          <Markdown content={message.content} />
        ) : searching ? (
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
            🔍 正在检索网页…
          </span>
        ) : message.pending && !message.reasoning ? (
          <span className="ts-caret text-[13px]" style={{ color: 'var(--muted)' }}>
            正在回答
          </span>
        ) : null}

        {!isUser && message.sources && message.sources.length > 0 ? (
          <SourceList sources={message.sources} />
        ) : null}
      </div>
    </div>
  );
}

export function FocusView({ nodeId, originRect, onClose }: FocusViewProps) {
  const projects = useStore((s) => s.projects);
  const nodes = useStore((s) => s.nodes);
  const messages = useStore((s) => s.messages);
  const secrets = useStore((s) => s.secrets);
  const settings = useStore((s) => s.settings);
  const streamingNodeId = useStore((s) => s.streamingNodeId);
  const updateNode = useStore((s) => s.updateNode);
  const renameNode = useStore((s) => s.renameNode);
  const focusMessageId = useStore((s) => s.focusMessageId);
  const clearFocusMessage = useStore((s) => s.clearFocusMessage);
  const deleteNode = useStore((s) => s.deleteNode);
  const sendMessage = useStore((s) => s.sendMessage);
  const regenerate = useStore((s) => s.regenerate);
  const editUserMessage = useStore((s) => s.editUserMessage);
  const stopStreaming = useStore((s) => s.stopStreaming);
  const createBranch = useStore((s) => s.createBranch);
  const focusNode = useStore((s) => s.focusNode);
  const focusNodeAt = useStore((s) => s.focusNodeAt);
  const useModel = useStore((s) => s.useModel);
  const togglePin = useStore((s) => s.togglePin);
  const refreshSummary = useStore((s) => s.refreshSummary);
  const mergeInsights = useStore((s) => s.mergeInsights);
  const applyPendingSummary = useStore((s) => s.applyPendingSummary);
  const discardPendingSummary = useStore((s) => s.discardPendingSummary);
  const refreshSynthesis = useStore((s) => s.refreshSynthesis);
  const generateSuggestionsFor = useStore((s) => s.generateSuggestionsFor);
  const setSuggestions = useStore((s) => s.setSuggestions);
  const addOpenQuestion = useStore((s) => s.addOpenQuestion);
  const toggleOpenQuestion = useStore((s) => s.toggleOpenQuestion);
  const removeOpenQuestion = useStore((s) => s.removeOpenQuestion);
  const thinking = useStore((s) => s.settings.thinking);
  const search = useStore((s) => s.settings.search);
  const searchingNodeId = useStore((s) => s.searchingNodeId);
  const setThinking = useStore((s) => s.setThinking);
  const setSearchEnabled = useStore((s) => s.setSearchEnabled);

  const [phase, setPhase] = useState<'enter' | 'open' | 'exit'>('enter');
  const [customModel, setCustomModel] = useState('');
  const [input, setInput] = useState('');
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [selectionMode, setSelectionMode] = useState<'actions' | 'intent'>('actions');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [understandingOpen, setUnderstandingOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState('');
  const [busy, setBusy] = useState<null | 'summary' | 'insight' | 'suggest' | 'synthesis'>(null);
  const pendingDraft = useRef<string | null>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const node = nodes.find((n) => n.id === nodeId);
  const project = projects.find((p) => p.id === node?.projectId);
  const nodeMessages = useMemo(
    () => messages.filter((m) => m.nodeId === nodeId),
    [messages, nodeId],
  );
  const path = useMemo(
    () => (node ? ancestorPath(nodes, node.id) : []),
    [nodes, node],
  );
  const provider = settings.providers.find((p) => p.id === settings.activeProviderId);
  const streaming = streamingNodeId === nodeId;

  const lastUserId = useMemo(() => {
    const users = nodeMessages.filter((m) => m.role === 'user');
    return users.length ? users[users.length - 1].id : null;
  }, [nodeMessages]);

  const lastAssistantId = useMemo(() => {
    const list = nodeMessages.filter((m) => m.role === 'assistant');
    return list.length ? list[list.length - 1].id : null;
  }, [nodeMessages]);

  const childNodes = useMemo(() => nodes.filter((n) => n.parentId === nodeId), [nodes, nodeId]);
  // 待解决问题属于整个项目：每张卡片看到的是同一份清单
  const openQuestions = project?.openQuestions ?? [];
  const unresolvedCount = openQuestions.filter((q) => !q.resolved).length;

  const mentionQuery = useMemo(() => {
    const match = /@([^\s@]*)$/.exec(input);
    return match ? match[1] : null;
  }, [input]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !node) return [];
    const q = mentionQuery.toLowerCase();
    return nodes
      .filter((n) => n.projectId === node.projectId && n.id !== node.id)
      .filter((n) => !q || n.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, nodes, node]);

  useEffect(() => {
    const t = setTimeout(() => setPhase('open'), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSelection(null);
    setSelectionMode('actions');
    setEditingMessageId(null);
    setInput(pendingDraft.current ?? '');
    pendingDraft.current = null;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [nodeId]);

  const lastContent = nodeMessages.length
    ? nodeMessages[nodeMessages.length - 1].content
    : '';

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [nodeMessages.length, lastContent]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // 从「查看所有提问」跳转过来时，滚动并高亮对应的那条消息
  useEffect(() => {
    if (!focusMessageId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${focusMessageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPulseId(focusMessageId);
        setTimeout(() => setPulseId(null), 1800);
      }
      clearFocusMessage();
    }, 340);
    return () => clearTimeout(timer);
  }, [focusMessageId, nodeId, clearFocusMessage]);

  const saveTitle = () => {
    const next = titleDraft.trim();
    if (next) renameNode(nodeId, next);
    setEditingTitle(false);
  };

  const close = useCallback(() => {
    setPhase('exit');
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selection) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, selection]);

  if (!node || !project) return null;

  const status = NODE_STATUS[node.status];

  const submit = () => {
    const text = input.trim();
    if (!text || streaming) return;
    const projectNodes = node ? nodes.filter((n) => n.projectId === node.projectId) : [];
    const mentions = extractMentions(text, projectNodes);
    setInput('');
    void sendMessage(nodeId, text, mentions);
  };

  const applyMention = (title: string) => {
    setInput((prev) => prev.replace(/@([^\s@]*)$/, `@${title} `));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRefreshSummary = async () => {
    setBusy('summary');
    try {
      await refreshSummary(nodeId);
    } finally {
      setBusy(null);
    }
  };

  const handleMerge = async () => {
    setBusy('insight');
    try {
      await mergeInsights(nodeId);
    } finally {
      setBusy(null);
    }
  };

  const handleSuggest = async () => {
    setBusy('suggest');
    try {
      await generateSuggestionsFor(nodeId);
    } finally {
      setBusy(null);
    }
  };

  const handleRefreshSynthesis = async () => {
    setBusy('synthesis');
    try {
      await refreshSynthesis(nodeId);
    } finally {
      setBusy(null);
    }
  };

  const submitQuestion = () => {
    const text = questionDraft.trim();
    if (!text) return;
    // 记录来源卡片，方便以后从这里一键跳回去
    addOpenQuestion(text, nodeId);
    setQuestionDraft('');
  };

  const markAsQuestion = (content: string) => {
    setUnderstandingOpen(true);
    setQuestionDraft(firstSentence(content));
    setTimeout(() => questionInputRef.current?.focus(), 60);
  };

  const acceptSuggestion = (suggestion: BranchSuggestion, sourceMessageId: string) => {
    const id = createBranch(
      nodeId,
      {
        sourceNodeId: nodeId,
        sourceMessageId,
        anchorText: suggestion.label,
        parentContextSummary: node?.summary,
      },
      suggestion.label,
      suggestion.intent,
    );
    if (!id) return;
    focusNode(id);
    void sendMessage(id, suggestion.question);
  };

  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditDraft(message.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const saveEdit = () => {
    const id = editingMessageId;
    const text = editDraft.trim();
    if (!id || !text) return;
    setEditingMessageId(null);
    setEditDraft('');
    void editUserMessage(nodeId, id, text);
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (!text || text.length < 2) {
      setSelection(null);
      return;
    }
    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionMode('actions');
    setSelection({ text, x: rect.left + rect.width / 2, y: rect.top });
  };

  const doExplain = () => {
    if (!selection) return;
    const text = selection.text;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    void sendMessage(nodeId, `请解释这段话的含义：\n\n「${text}」`);
  };

  const doAsk = () => {
    if (!selection) return;
    setInput(`关于「${selection.text}」：`);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const doBranch = (intent: BranchIntent) => {
    if (!selection) return;
    const text = selection.text;
    setSelection(null);
    setSelectionMode('actions');
    window.getSelection()?.removeAllRanges();

    const id = createBranch(
      nodeId,
      {
        sourceNodeId: nodeId,
        anchorText: text,
        parentContextSummary: node.summary,
      },
      text.length > 26 ? `${text.slice(0, 26)}…` : text,
      intent,
    );
    if (!id) return;

    focusNode(id);
    if (intent === 'custom') {
      // 自定义问题：把初始问题放进输入框，让用户先修改再发送
      pendingDraft.current = buildIntentQuestion('custom', text);
      setInput(pendingDraft.current);
      pendingDraft.current = null;
    } else {
      void sendMessage(id, buildIntentQuestion(intent, text));
    }
  };

  const rectStyle: React.CSSProperties =
    phase === 'enter' && originRect
      ? {
          left: originRect.left,
          top: originRect.top,
          width: originRect.width,
          height: originRect.height,
          opacity: 0.35,
          borderRadius: 18,
        }
      : phase === 'open'
        ? { left: 0, top: 0, width: '100vw', height: '100vh', opacity: 1, borderRadius: 0 }
        : originRect
          ? {
              left: originRect.left,
              top: originRect.top,
              width: originRect.width,
              height: originRect.height,
              opacity: 0,
              borderRadius: 18,
            }
          : { left: 0, top: 0, width: '100vw', height: '100vh', opacity: 0, borderRadius: 0 };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'var(--bg)',
          opacity: phase === 'open' ? 1 : 0,
          transition: 'opacity 260ms ease',
        }}
      />

      <div
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          ...rectStyle,
          background: 'var(--bg)',
          transition:
            'left 320ms cubic-bezier(0.22,1,0.36,1), top 320ms cubic-bezier(0.22,1,0.36,1), width 320ms cubic-bezier(0.22,1,0.36,1), height 320ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease, border-radius 320ms ease',
        }}
        onMouseUp={handleMouseUp}
      >
        <div
          className="flex h-13 shrink-0 items-center gap-2 px-3"
          style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', height: 52 }}
        >
          <button className="btn btn-outline" onClick={close}>
            <IconChevronLeft width={15} height={15} />
            返回地图
          </button>

          <div className="mx-1 hidden min-w-0 flex-1 items-center gap-1.5 text-[12px] md:flex" style={{ color: 'var(--faint)' }}>
            {path.slice(0, -1).map((p) => (
              <span key={p.id} className="flex min-w-0 items-center gap-1.5">
                <button
                  className="max-w-[150px] truncate hover:underline"
                  onClick={() => focusNode(p.id)}
                >
                  {p.title}
                </button>
                <span>/</span>
              </span>
            ))}
            <span className="max-w-[220px] truncate font-medium" style={{ color: 'var(--muted)' }}>
              {node.title}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Popover
              align="right"
              width={200}
              button={
                <button className="btn btn-outline">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                  {status.label}
                </button>
              }
            >
              {(closeMenu) => (
                <div>
                  {(Object.keys(NODE_STATUS) as NodeStatus[]).map((s) => (
                    <MenuItem
                      key={s}
                      onClick={() => {
                        updateNode(nodeId, { status: s });
                        closeMenu();
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: NODE_STATUS[s].color }}
                      />
                      <span className="flex-1">{NODE_STATUS[s].label}</span>
                      {s === node.status && <IconCheck width={13} height={13} />}
                    </MenuItem>
                  ))}
                </div>
              )}
            </Popover>

            <button
              className="btn btn-ghost hidden px-2 md:inline-flex"
              title={node.pinned ? '取消收藏' : '收藏这个主题'}
              style={{ color: node.pinned ? 'var(--accent)' : 'var(--muted)' }}
              onClick={() => togglePin(nodeId)}
            >
              <IconPin width={15} height={15} />
            </button>

            <button
              className="btn btn-ghost hidden px-2 md:inline-flex"
              title="复制这个主题的链接"
              onClick={() => {
                void copyText(buildNodeUrl(node.projectId, node.id)).then((ok) => {
                  if (!ok) alert('复制失败，请手动复制浏览器地址栏。');
                });
              }}
            >
              <IconLink width={15} height={15} />
            </button>

            {childNodes.length >= 2 && (
              <button
                className="btn btn-outline hidden md:inline-flex"
                title="把子分支的探索综合成更高层的理解"
                disabled={busy === 'insight'}
                onClick={() => void handleMerge()}
              >
                <IconSpark width={14} height={14} />
                <span className="hidden md:inline">
                  {busy === 'insight' ? '综合中…' : node.insight ? '刷新理解' : '综合理解'}
                </span>
              </button>
            )}

            <button
              className="btn btn-outline"
              title="新建一个子分支"
              onClick={() => {
                const id = createBranch(nodeId, {
                  sourceNodeId: nodeId,
                  parentContextSummary: node.summary,
                });
                if (id) focusNode(id);
              }}
            >
              <IconBranch width={14} height={14} />
              <span className="hidden md:inline">子分支</span>
            </button>

            <button
              className="btn btn-ghost hidden px-2 md:inline-flex"
              title="把当前主题及其所有子分支导出为 Markdown"
              onClick={() => {
                try {
                  downloadMarkdown(
                    exportBranchMarkdown(nodes, messages, node.id),
                    `${node.title}-分支`,
                  );
                } catch (err) {
                  alert(`导出失败：${err instanceof Error ? err.message : String(err)}`);
                }
              }}
            >
              <IconDownload width={15} height={15} />
            </button>

            <button
              className="btn btn-ghost hidden md:inline-flex"
              title="删除当前主题及其所有分支"
              onClick={() => {
                if (
                  confirm(
                    `删除主题「${node.title}」？\n它下面的所有分支与对话也会一并删除，且无法恢复。`,
                  )
                ) {
                  deleteNode(nodeId);
                  close();
                }
              }}
            >
              <IconTrash width={15} height={15} />
            </button>

            {/* 移动端：把次要操作收进「更多」 */}
            <Popover
              className="md:hidden"
              align="right"
              width={210}
              button={
                <button className="btn btn-ghost px-2" title="更多">
                  <IconMore width={16} height={16} />
                </button>
              }
            >
              {(closeMenu) => (
                <div>
                  <MenuItem
                    onClick={() => {
                      closeMenu();
                      togglePin(nodeId);
                    }}
                  >
                    <IconPin width={14} height={14} />
                    <span className="flex-1">{node.pinned ? '取消收藏' : '收藏'}</span>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      closeMenu();
                      void copyText(buildNodeUrl(node.projectId, node.id)).then((ok) => {
                        if (!ok) alert('复制失败，请手动复制浏览器地址栏。');
                      });
                    }}
                  >
                    <IconLink width={14} height={14} />
                    <span className="flex-1">复制链接</span>
                  </MenuItem>
                  {childNodes.length >= 2 && (
                    <MenuItem
                      onClick={() => {
                        closeMenu();
                        void handleMerge();
                      }}
                    >
                      <IconSpark width={14} height={14} />
                      <span className="flex-1">{node.insight ? '刷新综合理解' : '综合理解'}</span>
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={() => {
                      closeMenu();
                      try {
                        downloadMarkdown(
                          exportBranchMarkdown(nodes, messages, node.id),
                          `${node.title}-分支`,
                        );
                      } catch (err) {
                        alert(`导出失败：${err instanceof Error ? err.message : String(err)}`);
                      }
                    }}
                  >
                    <IconDownload width={14} height={14} />
                    <span className="flex-1">导出 Markdown</span>
                  </MenuItem>

                  <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

                  <MenuItem
                    danger
                    onClick={() => {
                      closeMenu();
                      if (
                        confirm(
                          `删除主题「${node.title}」？\n它下面的所有分支与对话也会一并删除，且无法恢复。`,
                        )
                      ) {
                        deleteNode(nodeId);
                        close();
                      }
                    }}
                  >
                    <IconTrash width={14} height={14} />
                    <span className="flex-1">删除主题</span>
                  </MenuItem>
                </div>
              )}
            </Popover>
          </div>
        </div>

        <div className="ts-scroll flex-1 overflow-y-auto px-3 py-4 md:px-5 md:py-6" ref={scrollRef}>
          <div className="mx-auto max-w-[820px]">
            {editingTitle ? (
              <input
                className="input mb-2 !text-lg font-semibold"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
              />
            ) : (
              <h1
                className="mb-2 cursor-text text-[22px] leading-snug font-semibold tracking-tight"
                title="点击可修改标题"
                onClick={() => {
                  setTitleDraft(node.title);
                  setEditingTitle(true);
                }}
              >
                {node.title}
              </h1>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {intentLabel(node.intent) && (
                <span className="chip" title="这个分支诞生时的思考方式">
                  {intentLabel(node.intent)}
                </span>
              )}
              {node.synthesis && (
                <span className="chip" title="由多个主题收敛而成">
                  综合节点
                </span>
              )}
              {node.pinned && <span className="chip">已收藏</span>}
              <span className="chip">{Math.ceil(nodeMessages.length / 2)} 轮</span>
              {unresolvedCount > 0 && <span className="chip">待解决 {unresolvedCount}</span>}
            </div>

            <div className="panel mb-4 rounded-xl">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px]"
                style={{ color: 'var(--muted)' }}
                onClick={() => setUnderstandingOpen((o) => !o)}
              >
                <IconSpark width={13} height={13} />
                <span>当前理解</span>
                {node.summaryUpdatedAt ? (
                  <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                    {new Date(node.summaryUpdatedAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : null}
                <span className="ml-auto text-[11px]" style={{ color: 'var(--faint)' }}>
                  {understandingOpen ? '收起' : '展开'}
                </span>
              </button>

              {understandingOpen && (
                <div className="px-3 pb-3">
                  {node.pendingSummary ? (
                    <SummaryReview
                      current={node.summary}
                      proposed={node.pendingSummary.text}
                      onAccept={() => applyPendingSummary(nodeId)}
                      onDiscard={() => discardPendingSummary(nodeId)}
                    />
                  ) : (
                    <>
                      {node.summary ? (
                        <p className="ts-prose text-[13px]">{node.summary}</p>
                      ) : (
                        <p className="text-[12.5px]" style={{ color: 'var(--faint)' }}>
                          还没有「当前理解」。聊过几轮后，点下面的按钮生成。
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          className="btn btn-ghost !px-2 !py-0.5 !text-[11.5px]"
                          disabled={busy === 'summary' || nodeMessages.length === 0}
                          style={{ opacity: nodeMessages.length === 0 ? 0.4 : 1 }}
                          onClick={() => void handleRefreshSummary()}
                        >
                          <IconRefresh width={12} height={12} />
                          {busy === 'summary' ? '生成中…' : '更新理解'}
                        </button>

                        {(node.summaryVersions?.length ?? 0) > 0 && (
                          <button
                            className="btn btn-ghost !px-2 !py-0.5 !text-[11.5px]"
                            onClick={() => setHistoryOpen((v) => !v)}
                          >
                            <IconHistory width={12} height={12} />
                            历史版本 · {node.summaryVersions!.length}
                          </button>
                        )}
                      </div>

                      {historyOpen && (node.summaryVersions?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {[...(node.summaryVersions ?? [])].reverse().map((v, i) => (
                            <div
                              key={`${v.at}-${i}`}
                              className="rounded-lg p-2"
                              style={{
                                background: 'var(--panel-2)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <div className="mb-0.5 text-[10.5px]" style={{ color: 'var(--faint)' }}>
                                {new Date(v.at).toLocaleString('zh-CN', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div
                                className="text-[12px] leading-relaxed"
                                style={{ color: 'var(--muted)' }}
                              >
                                {v.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {node.synthesis && (
                    <SynthesisBlock
                      node={node}
                      nodes={nodes}
                      busy={busy === 'synthesis'}
                      onRefresh={() => void handleRefreshSynthesis()}
                      onOpenSource={(id) => focusNodeAt(id)}
                    />
                  )}

                  {node.insight && (
                    <div
                      className="mt-3 rounded-lg p-2.5"
                      style={{
                        background: 'var(--accent-soft)',
                        border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
                      }}
                    >
                      <div
                        className="mb-1 flex items-center gap-1.5 text-[11px] font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        <IconSpark width={11} height={11} />
                        综合理解（由 {childNodes.length} 个子分支收敛而来）
                      </div>
                      <p className="ts-prose text-[12.5px]">{node.insight}</p>
                    </div>
                  )}

                  <div className="mt-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                      待解决问题 · {unresolvedCount}
                    </div>

                    <div className="flex flex-col gap-1">
                      {openQuestions.length === 0 && (
                        <p className="text-[12px]" style={{ color: 'var(--faint)' }}>
                          把还没搞懂的问题记在这里，之后可以从左侧「待解决问题」找回。
                        </p>
                      )}
                      {openQuestions.map((q) => {
                        const source = q.sourceNodeId
                          ? nodes.find((n) => n.id === q.sourceNodeId)
                          : undefined;
                        const fromHere = q.sourceNodeId === nodeId;
                        return (
                          <div key={q.id} className="group/q flex items-start gap-2">
                            <button
                              className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px]"
                              style={{
                                border: `1px solid ${
                                  q.resolved ? 'var(--accent)' : 'var(--border-strong)'
                                }`,
                                background: q.resolved ? 'var(--accent)' : 'transparent',
                              }}
                              title={q.resolved ? '标记为未解决' : '标记为已解决'}
                              onClick={() => toggleOpenQuestion(q.id)}
                            >
                              {q.resolved && <IconCheck width={10} height={10} />}
                            </button>
                            <button
                              className="min-w-0 flex-1 text-left text-[12.5px] leading-relaxed"
                              style={{
                                color: q.resolved ? 'var(--faint)' : 'var(--text)',
                                textDecoration: q.resolved ? 'line-through' : 'none',
                              }}
                              title={source ? `来自「${source.title}」，点击跳转` : undefined}
                              onClick={() => {
                                if (source) focusNodeAt(source.id, q.sourceMessageId);
                              }}
                            >
                              {q.text}
                              {source && !fromHere && (
                                <span
                                  className="ml-1.5 text-[10.5px]"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  · {source.title}
                                </span>
                              )}
                            </button>
                            <button
                              className="shrink-0 opacity-0 transition-opacity group-hover/q:opacity-100"
                              style={{ color: 'var(--faint)' }}
                              title="删除"
                              onClick={() => removeOpenQuestion(q.id)}
                            >
                              <IconX width={12} height={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex gap-1.5">
                      <input
                        ref={questionInputRef}
                        className="input !py-1 !text-[12px]"
                        placeholder="添加一个还没解决的问题…"
                        value={questionDraft}
                        onChange={(e) => setQuestionDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitQuestion();
                        }}
                      />
                      <button
                        className="btn btn-outline shrink-0 !px-2 !py-1"
                        title="添加"
                        onClick={submitQuestion}
                      >
                        <IconPlus width={13} height={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {node.anchor?.anchorText && (
              <div
                className="mb-5 rounded-xl px-3.5 py-2.5 text-[12.5px]"
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
                  color: 'var(--muted)',
                }}
              >
                <span className="mr-1 font-medium" style={{ color: 'var(--accent)' }}>
                  来自父主题的锚点
                </span>
                「{node.anchor.anchorText}」
              </div>
            )}

            {nodeMessages.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed px-5 py-8 text-center text-[13.5px]"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                这是这个主题的第一轮对话。
                <br />
                在下方输入你的问题，开始深入。
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {nodeMessages.map((m, i) => {
                  const isUser = m.role === 'user';
                  const isEditing = editingMessageId === m.id;
                  const isLastAssistant = !isUser && m.id === lastAssistantId;
                  const canEdit = isUser && m.id === lastUserId && !streaming;
                  const canRegenerate =
                    !isUser && m.id === lastAssistantId && !m.pending && !streaming;

                  return (
                    <div
                      key={m.id}
                      data-message-id={m.id}
                      className="group/msg flex flex-col rounded-2xl"
                      style={{
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        boxShadow:
                          pulseId === m.id
                            ? '0 0 0 3px color-mix(in srgb, var(--accent) 32%, transparent)'
                            : undefined,
                        transition: 'box-shadow 320ms ease',
                      }}
                    >
                      {isEditing ? (
                        <div
                          className="w-full rounded-2xl p-3"
                          style={{
                            maxWidth: 'min(760px, 92%)',
                            background: 'var(--panel)',
                            border: '1px solid var(--accent)',
                          }}
                        >
                          <textarea
                            className="input ts-scroll resize-none !text-[13.5px]"
                            rows={3}
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveEdit();
                              }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px]" style={{ color: 'var(--faint)' }}>
                              保存后会重新生成回答，其后的对话会被替换
                            </span>
                            <div className="flex gap-2">
                              <button className="btn btn-ghost !text-[12px]" onClick={cancelEdit}>
                                取消
                              </button>
                              <button className="btn btn-primary !text-[12px]" onClick={saveEdit}>
                                保存并重新生成
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <MessageBubble
                          message={m}
                          searching={
                            searchingNodeId === nodeId &&
                            i === nodeMessages.length - 1 &&
                            m.role === 'assistant' &&
                            !m.content
                          }
                        />
                      )}

                      {!isEditing && !isUser && m.contextManifest && (
                        <div style={{ width: 'min(760px, 92%)' }}>
                          <ContextLens manifest={m.contextManifest} />
                        </div>
                      )}

                      {!isEditing && (
                        <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
                          {canEdit && (
                            <button
                              className="btn btn-ghost !px-2 !py-0.5 !text-[11px]"
                              onClick={() => startEdit(m)}
                            >
                              <IconEdit width={12} height={12} />
                              编辑
                            </button>
                          )}
                          {canRegenerate && (
                            <button
                              className="btn btn-ghost !px-2 !py-0.5 !text-[11px]"
                              onClick={() => void regenerate(nodeId)}
                            >
                              <IconRefresh width={12} height={12} />
                              重新生成
                            </button>
                          )}
                          {m.content.trim().length > 0 && (
                            <button
                              className="btn btn-ghost !px-2 !py-0.5 !text-[11px]"
                              title="把这条内容记成一个待解决问题"
                              onClick={() => markAsQuestion(m.content)}
                            >
                              <IconPlus width={12} height={12} />
                              记为问题
                            </button>
                          )}
                        </div>
                      )}

                      {isLastAssistant &&
                        !m.pending &&
                        node.suggestionsFor === m.id &&
                        (node.suggestions?.length ?? 0) > 0 && (
                          <div
                            className="mt-2 rounded-xl p-3"
                            style={{
                              maxWidth: 'min(760px, 92%)',
                              border: '1px dashed var(--border-strong)',
                            }}
                          >
                            <div
                              className="mb-2 flex items-center gap-2 text-[11px]"
                              style={{ color: 'var(--muted)' }}
                            >
                              <IconSpark width={12} height={12} />
                              可能的探索方向
                              <button
                                className="btn btn-ghost ml-auto !px-1.5 !py-0 !text-[11px]"
                                disabled={busy === 'suggest'}
                                onClick={() => void handleSuggest()}
                              >
                                {busy === 'suggest' ? '生成中…' : '换一批'}
                              </button>
                              <button
                                className="btn btn-ghost !px-1.5 !py-0 !text-[11px]"
                                onClick={() => setSuggestions(nodeId, '', [])}
                              >
                                忽略
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {node.suggestions?.map((s, i) => (
                                <button
                                  key={`${s.intent}-${i}`}
                                  className="btn btn-outline !px-2.5 !py-1 !text-[12px]"
                                  title={s.question}
                                  onClick={() => acceptSuggestion(s, m.id)}
                                >
                                  <span className="chip !px-1.5 !py-0 !text-[10px]">
                                    {INTENT_META[s.intent].label}
                                  </span>
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="h-6" />
          </div>
        </div>

        <div
          className="ts-safe-bottom shrink-0 px-3 py-3 md:px-5 md:py-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--panel)' }}
        >
          <div className="mx-auto max-w-[820px]">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {provider?.thinkingStyle === 'deepseek' && (
                <button
                  className="btn !px-2.5 !py-1 !text-[12px]"
                  style={{
                    border: `1px solid ${thinking.enabled ? 'var(--accent)' : 'var(--border)'}`,
                    background: thinking.enabled
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                    color: thinking.enabled ? 'var(--accent)' : 'var(--muted)',
                  }}
                  onClick={() => setThinking({ enabled: !thinking.enabled })}
                >
                  <IconSpark width={13} height={13} />
                  深度思考：{thinking.enabled ? '开' : '关'}
                </button>
              )}

              {provider?.thinkingStyle === 'deepseek' && thinking.enabled && (
                <Popover
                  align="left"
                  placement="top"
                  width={140}
                  button={
                    <button className="btn btn-outline !px-2 !py-1 !text-[12px]">
                      强度：{EFFORT_LABEL[thinking.effort]}
                    </button>
                  }
                >
                  {(close) => (
                    <div>
                      {(['low', 'high', 'max'] as ThinkingEffort[]).map((e) => (
                        <MenuItem
                          key={e}
                          onClick={() => {
                            setThinking({ effort: e });
                            close();
                          }}
                        >
                          <span className="flex-1">{EFFORT_LABEL[e]}</span>
                          {thinking.effort === e && <IconCheck width={13} height={13} />}
                        </MenuItem>
                      ))}
                    </div>
                  )}
                </Popover>
              )}

              <button
                className="btn !px-2.5 !py-1 !text-[12px]"
                style={{
                  border: `1px solid ${search.enabled ? 'var(--accent)' : 'var(--border)'}`,
                  background: search.enabled
                    ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                    : 'transparent',
                  color: search.enabled ? 'var(--accent)' : 'var(--muted)',
                }}
                title="开启后，提问时会先检索网页，再把结果交给模型"
                onClick={() => setSearchEnabled(!search.enabled)}
              >
                <IconGlobe width={13} height={13} />
                联网搜索
              </button>

              <Popover
                align="left"
                placement="top"
                width={310}
                button={
                  <button className="btn btn-outline max-w-[190px] !px-2 !py-1 !text-[12px]">
                    <span className="truncate" style={{ color: 'var(--muted)' }}>
                      <span className="hidden md:inline">
                        {provider?.displayName ?? '未配置'} ·{' '}
                      </span>
                      {provider?.model ?? '—'}
                    </span>
                    {provider && provider.kind !== 'mock' && !secrets[provider.id] ? (
                      <span style={{ color: '#dc2626' }}>未填 Key</span>
                    ) : null}
                  </button>
                }
              >
                {(close) => (
                  <div className="ts-scroll max-h-[360px] overflow-y-auto">
                    {settings.providers.map((p) => {
                      const presets: ModelPreset[] = [...(p.presetModels ?? [])];
                      if (!presets.some((m) => m.id === p.model)) {
                        presets.push({ id: p.model, label: p.model, hint: '自定义' });
                      }
                      return (
                        <div key={p.id} className="mb-0.5">
                          <div
                            className="px-2.5 pt-2 pb-1 text-[10px] tracking-widest uppercase"
                            style={{ color: 'var(--faint)' }}
                          >
                            {p.displayName}
                          </div>
                          {presets.map((m) => {
                            const active =
                              settings.activeProviderId === p.id && p.model === m.id;
                            return (
                              <MenuItem
                                key={m.id}
                                onClick={() => {
                                  useModel(p.id, m.id);
                                  close();
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background: active ? 'var(--accent)' : 'var(--border-strong)',
                                  }}
                                />
                                <span className="flex-1">{m.label}</span>
                                {m.hint && (
                                  <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                                    {m.hint}
                                  </span>
                                )}
                                {active && <IconCheck width={13} height={13} />}
                              </MenuItem>
                            );
                          })}
                        </div>
                      );
                    })}

                    <div
                      className="mt-1 px-2 pt-2 pb-1"
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <div className="mb-1 text-[10px]" style={{ color: 'var(--faint)' }}>
                        自定义模型名（应用到 {provider?.displayName ?? '当前服务商'}）
                      </div>
                      <div className="mb-1.5 text-[10px] leading-relaxed" style={{ color: 'var(--faint)' }}>
                        这个名称会作为 API 的 model 参数原样发送给服务商。
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          className="input !py-1 !text-[12px]"
                          placeholder="如 deepseek-v4-pro"
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customModel.trim() && provider) {
                              useModel(provider.id, customModel.trim());
                              setCustomModel('');
                              close();
                            }
                          }}
                        />
                        <button
                          className="btn btn-outline shrink-0 !px-2 !py-1 !text-[12px]"
                          onClick={() => {
                            if (customModel.trim() && provider) {
                              useModel(provider.id, customModel.trim());
                              setCustomModel('');
                              close();
                            }
                          }}
                        >
                          使用
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Popover>
            </div>

            {mentionCandidates.length > 0 && (
              <div className="panel mb-2 rounded-xl p-1.5">
                <div
                  className="px-2 pb-1 text-[10px] tracking-widest uppercase"
                  style={{ color: 'var(--faint)' }}
                >
                  引用已有主题（只发送它的「当前理解」）
                </div>
                {mentionCandidates.map((n) => (
                  <MenuItem key={n.id} onClick={() => applyMention(n.title)}>
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: NODE_STATUS[n.status].color }}
                    />
                    <span className="flex-1 truncate">{n.title}</span>
                    {n.summary && (
                      <span
                        className="max-w-[120px] truncate text-[10px]"
                        style={{ color: 'var(--faint)' }}
                      >
                        {n.summary}
                      </span>
                    )}
                  </MenuItem>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="input ts-scroll max-h-40 resize-none"
                rows={1}
                placeholder="继续追问，或选中上面的文字创建分支…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              {streaming ? (
                <button className="btn btn-outline shrink-0" onClick={() => stopStreaming(nodeId)}>
                  <IconStop width={14} height={14} />
                  停止
                </button>
              ) : (
                <button
                  className="btn btn-primary shrink-0"
                  onClick={submit}
                  disabled={!input.trim()}
                  style={{ opacity: input.trim() ? 1 : 0.5 }}
                >
                  <IconSend width={15} height={15} />
                  发送
                </button>
              )}
            </div>

            <div
              className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
              style={{ color: 'var(--faint)' }}
            >
              <span>Enter 发送 / Shift+Enter 换行</span>
              <span>·</span>
              <span>选中文字可 解释 / 追问 / 分支</span>
              <span>·</span>
              <span>输入 @ 可引用其它主题</span>
            </div>
          </div>
        </div>
      </div>

      {selection && (
        <div
          className="panel ts-fade-up fixed z-[60] rounded-lg"
          style={{
            left: Math.max(
              12,
              Math.min(
                selection.x - (selectionMode === 'intent' ? 95 : 90),
                window.innerWidth - (selectionMode === 'intent' ? 210 : 200),
              ),
            ),
            top: Math.max(12, selection.y - (selectionMode === 'intent' ? 240 : 44)),
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {selectionMode === 'actions' ? (
            <div className="flex gap-0.5 p-0.5">
              <button className="btn btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={doExplain}>
                解释
              </button>
              <button className="btn btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={doAsk}>
                追问
              </button>
              <button
                className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                onClick={() => setSelectionMode('intent')}
              >
                分支 ›
              </button>
            </div>
          ) : (
            <div className="w-[196px] p-1">
              <button
                className="mb-0.5 flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px]"
                style={{ color: 'var(--faint)' }}
                onClick={() => setSelectionMode('actions')}
              >
                ‹ 返回
              </button>
              <div
                className="px-2 pb-1 text-[10px] tracking-widest uppercase"
                style={{ color: 'var(--faint)' }}
              >
                以什么方式探索
              </div>
              {INTENT_ORDER.map((intent) => (
                <button
                  key={intent}
                  className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'color-mix(in srgb, var(--text) 7%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => doBranch(intent)}
                >
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>
                    {INTENT_META[intent].label}
                  </span>
                  <span className="text-[10.5px]" style={{ color: 'var(--faint)' }}>
                    {INTENT_META[intent].hint}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
