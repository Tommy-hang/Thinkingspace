import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { MenuItem } from './Popover';
import { IconChevronDown, IconChevronRight, IconTrash } from './icons';

interface NodeMenuProps {
  nodeId: string;
  onClose: () => void;
}

/** 地图节点的次级操作菜单（避免在卡片上堆砌按钮） */
export function NodeMenu({ nodeId, onClose }: NodeMenuProps) {
  const nodes = useStore((s) => s.nodes);
  const toggleCollapse = useStore((s) => s.toggleCollapse);
  const deleteNode = useStore((s) => s.deleteNode);
  const openNodeMenu = useStore((s) => s.openNodeMenu);

  const node = nodes.find((n) => n.id === nodeId);
  const hasChildren = nodes.some((n) => n.parentId === nodeId);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
    const rect = el?.getBoundingClientRect();
    setPos(
      rect
        ? { x: rect.right - 10, y: rect.bottom - 10 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    );
  }, [nodeId]);

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

  if (!node || !pos) return null;

  return (
    <div
      className="ts-node-menu panel ts-fade-up fixed z-40 w-[196px] rounded-xl p-1.5"
      style={{
        left: Math.max(12, Math.min(pos.x, window.innerWidth - 208)),
        top: Math.max(12, Math.min(pos.y, window.innerHeight - 200)),
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {hasChildren && (
        <MenuItem
          onClick={() => {
            toggleCollapse(nodeId);
            openNodeMenu(null);
          }}
        >
          {node.collapsed ? (
            <IconChevronRight width={14} height={14} />
          ) : (
            <IconChevronDown width={14} height={14} />
          )}
          <span className="flex-1">{node.collapsed ? '展开子主题' : '折叠子主题'}</span>
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
            deleteNode(nodeId);
            openNodeMenu(null);
          }
        }}
      >
        <IconTrash width={14} height={14} />
        <span className="flex-1">删除主题</span>
      </MenuItem>
    </div>
  );
}
