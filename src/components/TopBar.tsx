import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { Popover, MenuItem } from './Popover';
import { buildBundle, downloadBundle } from '../lib/exportImport';
import { APP_VERSION } from '../version';
import {
  IconBranch,
  IconDownload,
  IconFolder,
  IconLayout,
  IconMoon,
  IconPlus,
  IconRedo,
  IconSearch,
  IconSettings,
  IconSun,
  IconTrash,
  IconUndo,
  IconUpload,
} from './icons';

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'thinkingspace';
}

export function TopBar() {
  const projects = useStore((s) => s.projects);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const messages = useStore((s) => s.messages);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const settings = useStore((s) => s.settings);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const createProject = useStore((s) => s.createProject);
  const renameProject = useStore((s) => s.renameProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const createRootNode = useStore((s) => s.createRootNode);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const updateSettings = useStore((s) => s.updateSettings);
  const importFromText = useStore((s) => s.importFromText);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.history.past.length > 0);
  const canRedo = useStore((s) => s.history.future.length > 0);

  const fileRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  const handleExport = (all: boolean) => {
    const bundle = buildBundle(
      { projects, nodes, edges, messages },
      all ? undefined : project ? [project.id] : undefined,
    );
    const name = all ? 'thinkingspace-all' : safeName(project?.title ?? 'project');
    downloadBundle(bundle, `${name}.thinkingspace.json`);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      importFromText(text);
    } catch (err) {
      alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <header
      className="relative z-30 flex h-13 shrink-0 items-center gap-1.5 px-3"
      style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', height: 52 }}
    >
      <button
        className="btn btn-ghost px-2"
        title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <IconBranch width={17} height={17} />
      </button>

      <div className="mr-1 flex items-center gap-2 pl-1">
        <span className="text-[15px] font-semibold tracking-tight">ThinkingSpace</span>
        <span className="chip hidden sm:inline-flex" title="当前前端版本，用于确认是否已刷新到最新代码">
          {APP_VERSION}
        </span>
      </div>

      {project && (
        <Popover
          width={280}
          button={
            <button className="btn btn-outline max-w-[220px]">
              <IconFolder width={14} height={14} />
              <span className="truncate">{project.title}</span>
            </button>
          }
        >
          {(close) => (
            <div>
              <div className="px-2 pt-1 pb-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--faint)' }}>
                项目
              </div>
              <div className="mb-1 max-h-56 overflow-y-auto ts-scroll">
                {projects.map((p) => (
                  <MenuItem
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p.id);
                      close();
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: p.id === activeProjectId ? 'var(--accent)' : 'var(--border-strong)',
                      }}
                    />
                    <span className="flex-1 truncate">{p.title}</span>
                    {p.id === activeProjectId && (
                      <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                        当前
                      </span>
                    )}
                  </MenuItem>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)' }} className="mt-1 pt-1">
                <MenuItem
                  onClick={() => {
                    createProject('未命名项目');
                    close();
                  }}
                >
                  <IconPlus width={14} height={14} /> 新建项目
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setDraft(project.title);
                    setRenaming(true);
                    close();
                  }}
                >
                  <IconSettings width={14} height={14} /> 重命名当前项目
                </MenuItem>
                <MenuItem
                  danger
                  onClick={() => {
                    if (
                      confirm(
                        `确定删除项目「${project.title}」吗？\n该项目的所有主题、分支和对话都会被删除，且无法恢复。`,
                      )
                    ) {
                      deleteProject(project.id);
                    }
                    close();
                  }}
                >
                  <IconTrash width={14} height={14} /> 删除当前项目
                </MenuItem>
              </div>
            </div>
          )}
        </Popover>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          className="btn btn-ghost px-2"
          onClick={undo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.32 }}
        >
          <IconUndo />
        </button>
        <button
          className="btn btn-ghost px-2"
          onClick={redo}
          disabled={!canRedo}
          title="重做 (Ctrl+Shift+Z)"
          style={{ opacity: canRedo ? 1 : 0.32 }}
        >
          <IconRedo />
        </button>

        <button className="btn btn-ghost" onClick={() => setSearchOpen(true)} title="搜索 (Ctrl+K)">
          <IconSearch />
          <span className="hidden md:inline">搜索</span>
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => applyAutoLayout()}
          title="整理地图布局"
          disabled={!project}
        >
          <IconLayout />
          <span className="hidden md:inline">整理布局</span>
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => createRootNode()}
          title="新建主题"
          disabled={!project}
        >
          <IconPlus />
          <span className="hidden md:inline">新主题</span>
        </button>

        <Popover
          align="right"
          width={220}
          button={
            <button className="btn btn-ghost" title="导入 / 导出">
              <IconDownload />
            </button>
          }
        >
          {(close) => (
            <div>
              <MenuItem
                onClick={() => {
                  handleExport(false);
                  close();
                }}
              >
                <IconDownload width={14} height={14} /> 导出当前项目
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleExport(true);
                  close();
                }}
              >
                <IconDownload width={14} height={14} /> 导出全部项目
              </MenuItem>
              <MenuItem
                onClick={() => {
                  fileRef.current?.click();
                  close();
                }}
              >
                <IconUpload width={14} height={14} /> 导入 .json 文件
              </MenuItem>
            </div>
          )}
        </Popover>

        <button
          className="btn btn-ghost"
          title="切换深浅色"
          onClick={() =>
            updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          }
        >
          {settings.theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)} title="设置">
          <IconSettings />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = '';
        }}
      />

      {renaming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(9,9,11,0.42)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRenaming(false);
          }}
        >
          <div className="panel w-[380px] rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="mb-3 text-sm font-semibold">重命名项目</h3>
            <input
              className="input mb-3"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && project) {
                  renameProject(project.id, draft);
                  setRenaming(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setRenaming(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (project) renameProject(project.id, draft);
                  setRenaming(false);
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
