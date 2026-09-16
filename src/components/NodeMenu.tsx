import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { MenuItem } from './Popover';
import { buildNodeUrl, copyText } from '../lib/link';
import { downloadMarkdown, exportBranchMarkdown } from '../lib/branchExport';
import {
  IconBranch,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLink,
  IconPin,
  IconPlus,
  IconSpark,
  IconTrash,
} from './icons';

type Mode = 'menu' | 'rename' | 'questions';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

/** 卡片 / 侧栏树共用的次级操作菜单 */
export function NodeMenu({ onClose }: { onClose: () => void }) {
  const nodeMenuId = useStore((s) => s.nodeMenuId);
  const nodeMenuAnchor = useStore((s) => s.nodeMenuAnchor);
  const nodes = useStore((s) => s.nodes);
  const messages = useStore((s) => s.messages);
  const openNodeMenu = useStore((s) => s.openNodeMenu);
  const togglePin = useStore((s) => s.togglePin);
  const toggleCollapse = useStore((s) => s.toggleCollapse);
  const renameNode = useStore((s) => s.renameNode);
  const hideNode = useStore((s) => s.hideNode);
  const hideChildren = useStore((s) => s.hideChildren);
  const unhideChildren = useStore((s) => s.unhideChildren);
  const unhideNode = useStore((s) => s.unhideNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const createChildBranch = useStore((s) => s.createChildBranch);
  const deleteChildren = useStore((s) => s.deleteChildren);
  const focusNodeAt = useStore((s) => s.focusNodeAt);

  const [mode, setMode] = useState<Mode>('menu');
  const [draft, setDraft] = useState('');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const node = nodes.find((n) => n.id === nodeMenuId);
  const childNodes = nodes.filter((n) => n.parentId === nodeMenuId);
  const hasChildren = childNodes.length > 0;
  const someChildHidden = childNodes.some((n) => n.hidden);

  useEffect(() => {
    if (!nodeMenuId) return;
    if (nodeMenuAnchor) {
      setPos(nodeMenuAnchor);
      return;
    }
    const el = document.querySelector(`.react-flow__node[data-id="${nodeMenuId}"]`);
    const rect = el?.getBoundingClientRect();
    setPos(
      rect
        ? { x: rect.right - 10, y: rect.bottom - 10 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    );
  }, [nodeMenuId, nodeMenuAnchor]);

  useEffect(() => {
    setMode('menu');
    setDraft('');
  }, [nodeMenuId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.ts-node-menu')) return;
      onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  if (!nodeMenuId || !node || !pos) return null;

  const questions = messages.filter((m) => m.nodeId === node.id && m.role === 'user');
  const close = () => openNodeMenu(null);

  const saveRename = () => {
    if (draft.trim()) renameNode(node.id, draft);
    close();
  };

  return (
    <div
      className="ts-node-menu panel ts-fade-up ts-scroll fixed z-40 w-[232px] overflow-y-auto rounded-xl p-1.5"
      style={{
        left: clamp(pos.x, 12, Math.max(12, window.innerWidth - 244)),
        top: clamp(pos.y, 12, Math.max(12, window.innerHeight - 340)),
        maxHeight: '72vh',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {mode === 'rename' && (
        <div className="p-1">
          <div className="mb-1.5 px-1 text-[11px]" style={{ color: 'var(--faint)' }}>
            重命名卡片
          </div>
          <input
            className="input !py-1.5 !text-[13px]"
            autoFocus
            value={draft}
            placeholder="输入新的标题"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename();
              if (e.key === 'Escape') setMode('menu');
            }}
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button className="btn btn-ghost !px-2 !py-1 !text-[12px]" onClick={() => setMode('menu')}>
              取消
            </button>
            <button className="btn btn-primary !px-2.5 !py-1 !text-[12px]" onClick={saveRename}>
              保存
            </button>
          </div>
        </div>
      )}

      {mode === 'questions' && (
        <div>
          <button
            className="mb-1 flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px]"
            style={{ color: 'var(--faint)' }}
            onClick={() => setMode('menu')}
          >
            ‹ 返回
          </button>
          <div
            className="px-2 pb-1 text-[10px] tracking-widest uppercase"
            style={{ color: 'var(--faint)' }}
          >
            本卡片的提问 · {questions.length}
          </div>
          {questions.length === 0 && (
            <div className="px-2 py-2 text-[12px]" style={{ color: 'var(--muted)' }}>
              这张卡片还没有提问。
            </div>
          )}
          {questions.map((q, i) => (
            <button
              key={q.id}
              className="mb-0.5 flex w-full gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 7%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                focusNodeAt(node.id, q.id);
                onClose();
              }}
            >
              <span className="shrink-0 text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
                {i + 1}
              </span>
              <span
                className="text-[12px] leading-snug"
                style={{
                  color: 'var(--text)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {q.content}
              </span>
            </button>
          ))}
        </div>
      )}

      {mode === 'menu' && (
        <div>
          <MenuItem
            onClick={() => {
              togglePin(node.id);
              close();
            }}
          >
            <IconPin width={14} height={14} />
            <span className="flex-1">{node.pinned ? '取消收藏' : '收藏'}</span>
          </MenuItem>

          <MenuItem
            onClick={() => {
              setDraft(node.title);
              setMode('rename');
            }}
          >
            <IconEdit width={14} height={14} />
            <span className="flex-1">重命名卡片</span>
          </MenuItem>

          <MenuItem
            onClick={() => {
              setMode('questions');
            }}
          >
            <IconSpark width={14} height={14} />
            <span className="flex-1">查看所有提问</span>
            <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
              {questions.length}
            </span>
          </MenuItem>

          <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

          <MenuItem
            onClick={() => {
              void copyText(buildNodeUrl(node.projectId, node.id)).then((ok) => {
                if (!ok) alert('复制失败，请手动复制浏览器地址栏。');
              });
              close();
            }}
          >
            <IconLink width={14} height={14} />
            <span className="flex-1">复制链接</span>
          </MenuItem>

          <MenuItem
            onClick={() => {
              try {
                downloadMarkdown(
                  exportBranchMarkdown(nodes, messages, node.id),
                  `${node.title}-分支`,
                );
              } catch (err) {
                alert(`导出失败：${err instanceof Error ? err.message : String(err)}`);
              }
              close();
            }}
          >
            <IconDownload width={14} height={14} />
            <span className="flex-1">导出为 Markdown</span>
          </MenuItem>

          <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

          <MenuItem
            onClick={() => {
              createChildBranch(node.id);
              close();
            }}
          >
            <IconPlus width={14} height={14} />
            <span className="flex-1">创建子分支</span>
          </MenuItem>

          {hasChildren && (
            <MenuItem
              onClick={() => {
                toggleCollapse(node.id);
                close();
              }}
            >
              {node.collapsed ? (
                <IconChevronRight width={14} height={14} />
              ) : (
                <IconChevronDown width={14} height={14} />
              )}
              <span className="flex-1">{node.collapsed ? '展开子分支' : '折叠子分支'}</span>
            </MenuItem>
          )}

          {hasChildren &&
            (someChildHidden ? (
              <MenuItem
                onClick={() => {
                  unhideChildren(node.id);
                  close();
                }}
              >
                <IconEye width={14} height={14} />
                <span className="flex-1">显示子分支</span>
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  hideChildren(node.id);
                  close();
                }}
              >
                <IconEyeOff width={14} height={14} />
                <span className="flex-1">隐藏子分支</span>
              </MenuItem>
            ))}

          {node.hidden ? (
            <MenuItem
              onClick={() => {
                unhideNode(node.id);
                close();
              }}
            >
              <IconEye width={14} height={14} />
              <span className="flex-1">取消隐藏自身</span>
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                hideNode(node.id);
                close();
              }}
            >
              <IconEyeOff width={14} height={14} />
              <span className="flex-1">隐藏自身（含子分支）</span>
            </MenuItem>
          )}

          <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

          {hasChildren && (
            <MenuItem
              danger
              onClick={() => {
                const count = nodes.filter((n) => n.parentId === node.id).length;
                if (
                  confirm(
                    `删除「${node.title}」下的全部 ${count} 个子分支？\n它们各自的后代与对话也会一并删除，且无法恢复。\n（这张卡片本身会保留）`,
                  )
                ) {
                  deleteChildren(node.id);
                  close();
                }
              }}
            >
              <IconBranch width={14} height={14} />
              <span className="flex-1">删除子分支</span>
            </MenuItem>
          )}

          <MenuItem
            danger
            onClick={() => {
              if (
                confirm(
                  `删除主题「${node.title}」？\n它下面的所有分支与对话也会一并删除，且无法恢复。`,
                )
              ) {
                deleteNode(node.id);
                close();
              }
            }}
          >
            <IconTrash width={14} height={14} />
            <span className="flex-1">删除主题</span>
          </MenuItem>
        </div>
      )}
    </div>
  );
}
