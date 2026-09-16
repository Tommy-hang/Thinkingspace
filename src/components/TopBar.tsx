import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { Popover, MenuItem } from './Popover';
import { buildBundle, downloadBundle } from '../lib/exportImport';
import { APP_VERSION } from '../version';
import {
  IconBranch,
  IconDownload,
  IconFolder,
  IconHelp,
  IconHistory,
  IconInfo,
  IconLayers,
  IconLayout,
  IconMap,
  IconMoon,
  IconMore,
  IconPlus,
  IconRedo,
  IconSearch,
  IconSettings,
  IconSun,
  IconTrash,
  IconUndo,
  IconUpload,
  IconUser,
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
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const setKnowledgeOpen = useStore((s) => s.setKnowledgeOpen);
  const setReplayOpen = useStore((s) => s.setReplayOpen);
  const setSynthesisOpen = useStore((s) => s.setSynthesisOpen);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const setFeedbackOpen = useStore((s) => s.setFeedbackOpen);
  const cloudUser = useStore((s) => s.cloudUser);
  const cloudStatus = useStore((s) => s.cloudStatus);
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

  const cloudLabel = cloudUser ? '账号' : cloudStatus === 'disabled' ? '本机模式' : '登录';
  const cloudTip = cloudUser
    ? `已登录 ${cloudUser.email} · ${
        cloudStatus === 'synced'
          ? '已同步'
          : cloudStatus === 'syncing'
            ? '同步中'
            : cloudStatus === 'error'
              ? '同步出错'
              : '未登录'
      }`
    : cloudStatus === 'disabled'
      ? '云端未启用（内容仅保存在本机）'
      : '登录 / 注册（可跨设备同步）';

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
        className="btn btn-ghost ts-tip shrink-0 px-2"
        data-tip={sidebarOpen ? '收起侧栏' : '展开侧栏'}
        title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <IconBranch width={17} height={17} />
      </button>

      <div className="mr-1 hidden shrink-0 items-center gap-2 pl-1 md:flex">
        <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">
          ThinkingSpace
        </span>
        <span
          className="chip hidden whitespace-nowrap sm:inline-flex"
          title="当前前端版本，用于确认是否已刷新到最新代码"
        >
          {APP_VERSION}
        </span>
      </div>

      {project && (
        <Popover
          width={280}
          button={
            <button className="btn btn-outline min-w-0 max-w-[130px] shrink md:max-w-[150px] xl:max-w-[180px]">
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

      <div className="ml-auto flex min-w-0 items-center gap-1">
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 px-2 lg:inline-flex"
          onClick={undo}
          disabled={!canUndo}
          data-tip="撤销 (Ctrl+Z)"
          title="撤销 (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.32 }}
        >
          <IconUndo />
        </button>
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 px-2 lg:inline-flex"
          onClick={redo}
          disabled={!canRedo}
          data-tip="重做 (Ctrl+Shift+Z)"
          title="重做 (Ctrl+Shift+Z)"
          style={{ opacity: canRedo ? 1 : 0.32 }}
        >
          <IconRedo />
        </button>

        <button
          className="btn btn-ghost ts-tip shrink-0 px-2 md:px-3"
          onClick={() => setSearchOpen(true)}
          data-tip="搜索标题、摘要与全部对话 (Ctrl+K)"
          title="搜索 (Ctrl+K)"
        >
          <IconSearch />
          <span className="hidden whitespace-nowrap xl:inline">搜索</span>
        </button>
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          onClick={() => setKnowledgeOpen(true)}
          data-tip="由全部卡片的「当前理解」生成知识点思维导图"
          title="知识地图（由全部卡片的「当前理解」生成）"
          disabled={!project}
        >
          <IconMap />
          <span className="hidden whitespace-nowrap 2xl:inline">知识地图</span>
        </button>
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          onClick={() => setReplayOpen(true)}
          data-tip="回放这张地图是怎么一步步长出来的"
          title="思考回放（看这棵树是怎么长出来的）"
          disabled={!project}
        >
          <IconHistory />
          <span className="hidden whitespace-nowrap xl:inline">回放</span>
        </button>
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          onClick={() => setSynthesisOpen(true)}
          data-tip="选中多个主题，收敛成更高层的认识"
          title="综合多个主题，收敛成更高层的认识"
          disabled={!project}
        >
          <IconLayers />
          <span className="hidden whitespace-nowrap xl:inline">综合</span>
        </button>
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          onClick={() => applyAutoLayout()}
          data-tip="把地图排成整齐的树形"
          title="整理地图布局"
          disabled={!project}
        >
          <IconLayout />
          <span className="hidden whitespace-nowrap 2xl:inline">整理布局</span>
        </button>
        <button
          className="btn btn-ghost ts-tip shrink-0 px-2 md:px-3"
          onClick={() => createRootNode()}
          data-tip="新建一个主题"
          title="新建主题"
          disabled={!project}
        >
          <IconPlus />
          <span className="hidden whitespace-nowrap xl:inline">新主题</span>
        </button>

        <Popover
          className="hidden lg:block"
          align="right"
          width={220}
          button={
            <button
              className="btn btn-ghost ts-tip shrink-0"
              data-tip="导出 / 导入项目"
              title="导入 / 导出"
            >
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
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          data-tip="切换深色 / 浅色"
          title="切换深浅色"
          onClick={() =>
            updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          }
        >
          {settings.theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button
          className="btn btn-ghost ts-tip shrink-0 px-2 md:px-3"
          onClick={() => setAuthOpen(true)}
          data-tip={cloudTip}
          title={cloudTip}
          style={{ color: cloudUser ? 'var(--accent)' : undefined }}
        >
          <IconUser />
          {cloudUser && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  cloudStatus === 'synced'
                    ? '#16a34a'
                    : cloudStatus === 'syncing'
                      ? 'var(--accent)'
                      : cloudStatus === 'error'
                        ? '#dc2626'
                        : 'var(--border-strong)',
              }}
            />
          )}
          <span className="hidden whitespace-nowrap xl:inline">{cloudLabel}</span>
        </button>

        <button
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          onClick={() => setHelpOpen(true)}
          data-tip="使用说明"
          title="使用说明"
        >
          <IconHelp />
        </button>
        <button
          className="btn btn-ghost ts-tip hidden shrink-0 lg:inline-flex"
          onClick={() => setSettingsOpen(true)}
          data-tip="设置（API Key / 模型 / 隐私）"
          title="设置"
        >
          <IconSettings />
        </button>

        {/* 窄屏：更多 */}
        <Popover
          className="lg:hidden"
          align="right"
          width={220}
          button={
            <button className="btn btn-ghost ts-tip shrink-0 px-2" data-tip="更多操作" title="更多">
              <IconMore />
            </button>
          }
        >
          {(close) => (
            <div>
              <MenuItem
                disabled={!project}
                onClick={() => {
                  close();
                  setKnowledgeOpen(true);
                }}
              >
                <IconMap width={14} height={14} />
                <span className="flex-1">知识地图</span>
              </MenuItem>
              <MenuItem
                disabled={!project}
                onClick={() => {
                  close();
                  setReplayOpen(true);
                }}
              >
                <IconHistory width={14} height={14} />
                <span className="flex-1">思考回放</span>
              </MenuItem>
              <MenuItem
                disabled={!project}
                onClick={() => {
                  close();
                  setSynthesisOpen(true);
                }}
              >
                <IconLayers width={14} height={14} />
                <span className="flex-1">综合多个主题</span>
              </MenuItem>
              <MenuItem
                disabled={!project}
                onClick={() => {
                  close();
                  applyAutoLayout();
                }}
              >
                <IconLayout width={14} height={14} />
                <span className="flex-1">整理布局</span>
              </MenuItem>

              <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

              <MenuItem
                disabled={!canUndo}
                onClick={() => {
                  close();
                  undo();
                }}
              >
                <IconUndo width={14} height={14} />
                <span className="flex-1">撤销</span>
              </MenuItem>
              <MenuItem
                disabled={!canRedo}
                onClick={() => {
                  close();
                  redo();
                }}
              >
                <IconRedo width={14} height={14} />
                <span className="flex-1">重做</span>
              </MenuItem>

              <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

              <MenuItem
                onClick={() => {
                  close();
                  handleExport(false);
                }}
              >
                <IconDownload width={14} height={14} />
                <span className="flex-1">导出当前项目</span>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  handleExport(true);
                }}
              >
                <IconDownload width={14} height={14} />
                <span className="flex-1">导出全部项目</span>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  fileRef.current?.click();
                }}
              >
                <IconUpload width={14} height={14} />
                <span className="flex-1">导入 .json 文件</span>
              </MenuItem>

              <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />

              <MenuItem
                onClick={() => {
                  close();
                  updateSettings({
                    theme: settings.theme === 'dark' ? 'light' : 'dark',
                  });
                }}
              >
                {settings.theme === 'dark' ? (
                  <IconSun width={14} height={14} />
                ) : (
                  <IconMoon width={14} height={14} />
                )}
                <span className="flex-1">
                  {settings.theme === 'dark' ? '切换浅色' : '切换深色'}
                </span>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  setHelpOpen(true);
                }}
              >
                <IconHelp width={14} height={14} />
                <span className="flex-1">使用说明</span>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  setSettingsOpen(true);
                }}
              >
                <IconSettings width={14} height={14} />
                <span className="flex-1">设置</span>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  setFeedbackOpen(true);
                }}
              >
                <IconInfo width={14} height={14} />
                <span className="flex-1">反馈问题</span>
              </MenuItem>
            </div>
          )}
        </Popover>
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
