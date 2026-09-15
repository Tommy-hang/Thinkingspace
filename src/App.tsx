import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useStore } from './store/store';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { FocusView } from './components/FocusView';
import { SearchPanel } from './components/SearchPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpPanel } from './components/HelpPanel';
import { AuthPanel } from './components/AuthPanel';
import { KnowledgeMapView } from './components/KnowledgeMapView';
import { NodeMenu } from './components/NodeMenu';
import { buildNodeHash, parseNodeHash } from './lib/link';

export default function App() {
  const theme = useStore((s) => s.settings.theme);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const focusedNodeId = useStore((s) => s.focusedNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const initCloud = useStore((s) => s.initCloud);

  useEffect(() => {
    void initCloud();
  }, [initCloud]);

  const [origin, setOrigin] = useState<{ id: string; rect: DOMRect | null } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // 通过链接打开某个 Topic：#/p/<projectId>/n/<nodeId>
  useEffect(() => {
    const apply = (initial: boolean) => {
      const link = parseNodeHash(window.location.hash);
      if (!link) return;
      const state = useStore.getState();
      if (link.projectId && state.projects.some((p) => p.id === link.projectId)) {
        if (state.activeProjectId !== link.projectId) state.setActiveProject(link.projectId);
      }
      const go = () => {
        const s = useStore.getState();
        if (link.nodeId && s.nodes.some((n) => n.id === link.nodeId)) {
          s.revealNode(link.nodeId);
          s.focusNode(link.nodeId);
        }
      };
      if (initial) setTimeout(go, 420);
      else go();
    };

    apply(true);
    const onHash = () => apply(false);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 打开某个 Topic 时，把地址栏同步为可复制的链接
  useEffect(() => {
    if (!focusedNodeId) return;
    const node = useStore.getState().nodes.find((n) => n.id === focusedNodeId);
    if (!node) return;
    const hash = buildNodeHash(node.projectId, node.id);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  }, [focusedNodeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (!mod) return;

      // 输入框 / 文本域中保留浏览器原生的文本撤销行为
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen, undo, redo]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar />}
        <main className="relative min-h-0 flex-1">
          <ReactFlowProvider>
            <MapView
              onOpenNode={(id, rect) => {
                setOrigin({ id, rect });
                focusNode(id);
              }}
            />
          </ReactFlowProvider>
        </main>
      </div>

      {focusedNodeId && (
        <FocusView
          nodeId={focusedNodeId}
          originRect={origin?.id === focusedNodeId ? origin.rect : null}
          onClose={() => focusNode(null)}
        />
      )}

      <KnowledgeMapView />
      <NodeMenu onClose={() => useStore.getState().openNodeMenu(null)} />
      <SearchPanel />
      <SettingsPanel />
      <HelpPanel />
      <AuthPanel />
    </div>
  );
}
