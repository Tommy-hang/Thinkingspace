import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { NODE_STATUS, type Message, type TopicNode } from '../types';
import { Modal } from './Modal';
import { IconSearch } from './icons';

interface NodeHit {
  kind: 'node';
  node: TopicNode;
  field: '标题' | '摘要';
  snippet: string;
}
interface MessageHit {
  kind: 'message';
  node: TopicNode;
  message: Message;
  snippet: string;
}
type Hit = NodeHit | MessageHit;

function makeSnippet(text: string, query: string, radius = 42): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function SearchPanel() {
  const open = useStore((s) => s.searchOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const nodes = useStore((s) => s.nodes);
  const messages = useStore((s) => s.messages);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const revealNode = useStore((s) => s.revealNode);
  const focusNode = useStore((s) => s.focusNode);

  const [query, setQuery] = useState('');

  const project = projects.find((p) => p.id === activeProjectId);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim();
    if (!q || !activeProjectId) return [];
    const projectNodes = nodes.filter((n) => n.projectId === activeProjectId);
    const nodeById = new Map(projectNodes.map((n) => [n.id, n]));
    const result: Hit[] = [];

    for (const n of projectNodes) {
      if (n.title.toLowerCase().includes(q.toLowerCase())) {
        result.push({ kind: 'node', node: n, field: '标题', snippet: n.title });
      } else if (n.summary.toLowerCase().includes(q.toLowerCase())) {
        result.push({
          kind: 'node',
          node: n,
          field: '摘要',
          snippet: makeSnippet(n.summary, q),
        });
      }
    }

    for (const m of messages) {
      const node = nodeById.get(m.nodeId);
      if (!node) continue;
      if (m.content.toLowerCase().includes(q.toLowerCase())) {
        result.push({
          kind: 'message',
          node,
          message: m,
          snippet: makeSnippet(m.content, q),
        });
      }
    }

    return result.slice(0, 60);
  }, [query, nodes, messages, activeProjectId]);

  const close = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const openHit = (hit: Hit) => {
    if (hit.kind === 'node') {
      revealNode(hit.node.id);
    } else {
      focusNode(hit.node.id);
    }
    close();
  };

  return (
    <Modal open={open} title="搜索思考空间" onClose={close} width={620}>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute top-1/2 left-3 -translate-y-1/2" style={{ color: 'var(--faint)' }}>
            <IconSearch width={15} height={15} />
          </span>
          <input
            className="input !pl-9"
            autoFocus
            placeholder={project ? `在「${project.title}」中搜索主题与对话…` : '搜索…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hits[0]) openHit(hits[0]);
            }}
          />
        </div>
      </div>

      {!query.trim() && (
        <p className="py-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
          输入关键词，搜索主题标题、摘要与全部对话内容。
        </p>
      )}

      {query.trim() && hits.length === 0 && (
        <p className="py-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
          没有找到匹配内容。
        </p>
      )}

      <div className="flex flex-col gap-1">
        {hits.map((hit, i) => {
          const status = NODE_STATUS[hit.node.status];
          return (
            <button
              key={i}
              className="rounded-xl px-3 py-2.5 text-left transition-colors"
              style={{ border: '1px solid var(--border)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 5%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => openHit(hit)}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                <span className="text-[13px] font-medium">{hit.node.title}</span>
                <span className="chip !py-0 !text-[10px]">
                  {hit.kind === 'node' ? `主题${hit.field}` : hit.message.role === 'user' ? '我的提问' : 'AI 回答'}
                </span>
              </div>
              <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {hit.snippet}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
