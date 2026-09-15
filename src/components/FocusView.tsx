import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store/store';
import { NODE_STATUS, type NodeStatus, type Message } from '../types';
import { ancestorPath } from '../lib/ai/contextBuilder';
import { Popover, MenuItem } from './Popover';
import {
  IconBranch,
  IconCheck,
  IconChevronLeft,
  IconSend,
  IconStop,
  IconTrash,
} from './icons';

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

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={key++}
          className="rounded px-1 py-0.5 text-[0.9em]"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="ts-prose max-w-[min(720px,88%)] rounded-2xl px-4 py-3 text-[14px]"
        style={{
          background: isUser ? 'var(--accent)' : 'var(--panel)',
          color: isUser ? 'var(--accent-text)' : 'var(--text)',
          border: isUser ? '1px solid transparent' : '1px solid var(--border)',
          borderColor: message.error ? '#dc2626' : undefined,
        }}
      >
        {message.content ? (
          <div className={message.pending ? 'ts-caret' : ''}>{renderInline(message.content)}</div>
        ) : message.pending ? (
          <span className="ts-caret text-[13px]" style={{ color: 'var(--muted)' }}>
            正在思考
          </span>
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
  const deleteNode = useStore((s) => s.deleteNode);
  const sendMessage = useStore((s) => s.sendMessage);
  const stopStreaming = useStore((s) => s.stopStreaming);
  const createBranch = useStore((s) => s.createBranch);
  const focusNode = useStore((s) => s.focusNode);

  const [phase, setPhase] = useState<'enter' | 'open' | 'exit'>('enter');
  const [input, setInput] = useState('');
  const [selection, setSelection] = useState<SelectionState | null>(null);
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

  useEffect(() => {
    const t = setTimeout(() => setPhase('open'), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSelection(null);
    setInput('');
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
    setInput('');
    void sendMessage(nodeId, text);
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

  const doBranch = () => {
    if (!selection) return;
    const text = selection.text;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    const id = createBranch(
      nodeId,
      {
        sourceNodeId: nodeId,
        anchorText: text,
        parentContextSummary: node.summary,
      },
      text.length > 26 ? `${text.slice(0, 26)}…` : text,
    );
    if (id) focusNode(id);
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
              className="btn btn-ghost"
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
          </div>
        </div>

        <div className="ts-scroll flex-1 overflow-y-auto px-5 py-6" ref={scrollRef}>
          <div className="mx-auto max-w-[820px]">
            {editingTitle ? (
              <input
                className="input mb-2 !text-lg font-semibold"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  updateNode(nodeId, { title: titleDraft.trim() || '未命名主题' });
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateNode(nodeId, { title: titleDraft.trim() || '未命名主题' });
                    setEditingTitle(false);
                  }
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
                {nodeMessages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
            )}
            <div className="h-6" />
          </div>
        </div>

        <div
          className="shrink-0 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--panel)' }}
        >
          <div className="mx-auto max-w-[820px]">
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
            <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: 'var(--faint)' }}>
              <span>
                当前模型：{provider?.displayName ?? '未配置'}
                {provider && provider.kind !== 'mock' && !secrets[provider.id] ? '（未填 Key）' : ''}
              </span>
              <span>·</span>
              <span>Enter 发送 / Shift+Enter 换行</span>
              <span>·</span>
              <span>选中文字可 解释 / 追问 / 分支</span>
            </div>
          </div>
        </div>
      </div>

      {selection && (
        <div
          className="panel ts-fade-up fixed z-[60] flex gap-0.5 rounded-lg p-0.5"
          style={{
            left: Math.max(12, Math.min(selection.x - 90, window.innerWidth - 200)),
            top: Math.max(12, selection.y - 44),
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button className="btn btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={doExplain}>
            解释
          </button>
          <button className="btn btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={doAsk}>
            追问
          </button>
          <button className="btn btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={doBranch}>
            分支
          </button>
        </div>
      )}
    </>
  );
}
