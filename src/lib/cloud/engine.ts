import type { GraphEdge, Message, Project, Settings, TopicNode } from '../../types';
import {
  deleteRemoteProjects,
  fetchProjectContents,
  pullProjectMetas,
  pullSettings,
  pushProject,
  pushSettings,
  type ProjectContent,
  type RemoteProject,
} from './sync';

export interface WorkspaceSnapshot {
  projects: Project[];
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
  settings: Settings;
}

export interface MergeOutcome {
  snapshot: WorkspaceSnapshot;
  pulledCount: number;
  pushedCount: number;
  warnings: string[];
}

export interface PushOutcome {
  pushed: number;
  warnings: string[];
  /** 推送成功后云端返回的版本信息，需要写回本地项目 */
  updated: { id: string; revision: number; updatedAt: number }[];
}

/** 记录每个项目「上次同步时云端的版本号」，用于发现冲突 */
const knownRevisions = new Map<string, number>();
let activeUserId: string | null = null;

export function resetCloudEngine(userId: string | null): void {
  knownRevisions.clear();
  activeUserId = userId;
}

export function hasCloudSession(): boolean {
  return activeUserId !== null;
}

function contentOf(snapshot: WorkspaceSnapshot, project: Project): ProjectContent {
  const nodeIds = new Set(
    snapshot.nodes.filter((n) => n.projectId === project.id).map((n) => n.id),
  );
  return {
    createdAt: project.createdAt,
    nodes: snapshot.nodes.filter((n) => n.projectId === project.id),
    edges: snapshot.edges.filter((e) => e.projectId === project.id),
    messages: snapshot.messages.filter((m) => nodeIds.has(m.nodeId)),
    openQuestions: project.openQuestions,
    knowledgeMap: project.knowledgeMap,
  };
}

function projectFromRemote(remote: RemoteProject): Project {
  return {
    id: remote.id,
    title: remote.title,
    summary: remote.summary,
    createdAt: remote.content.createdAt,
    updatedAt: remote.updatedAt,
    openQuestions: remote.content.openQuestions,
    knowledgeMap: remote.content.knowledgeMap,
  };
}

/** 本地是否有「尚未上传」的改动 */
function hasLocalChanges(project: Project): boolean {
  return project.updatedAt > (project.cloudUpdatedAt ?? 0);
}

async function pushOne(
  project: Project,
  local: WorkspaceSnapshot,
  warnings: string[],
): Promise<{ revision: number; updatedAt: number } | null> {
  const content = contentOf(local, project);
  const first = await pushProject(project, content, knownRevisions.get(project.id));

  if (first.status === 'created' || first.status === 'updated') {
    knownRevisions.set(project.id, first.revision);
    return { revision: first.revision, updatedAt: first.updatedAt };
  }

  if (first.status === 'conflict') {
    const retry = await pushProject(project, content, first.remote.revision);
    if (retry.status === 'created' || retry.status === 'updated') {
      knownRevisions.set(project.id, retry.revision);
      warnings.push(`「${project.title}」在别处也被修改过，已按本地版本保存。`);
      return { revision: retry.revision, updatedAt: retry.updatedAt };
    }
    warnings.push(`「${project.title}」同步失败，稍后会自动重试。`);
    return null;
  }

  if (first.status === 'error') {
    warnings.push(`「${project.title}」：${first.message}`);
  }
  return null;
}

/**
 * 登录后的完整同步。
 *
 * 省流量的关键：先只拉「项目元信息」（很小），
 * 只有当云端某个项目确实变过时，才去拉它的完整内容。
 */
export async function fullSync(local: WorkspaceSnapshot): Promise<MergeOutcome> {
  const metas = await pullProjectMetas();
  if (!metas) {
    return { snapshot: local, pulledCount: 0, pushedCount: 0, warnings: [] };
  }
  const remoteSettings = await pullSettings();

  const localById = new Map(local.projects.map((p) => [p.id, p]));
  const metaById = new Map(metas.map((m) => [m.id, m]));

  // 按需加载：只拉云端确实更新过的项目内容
  const needIds: string[] = [];
  for (const meta of metas) {
    const localProject = localById.get(meta.id);
    if (!localProject) {
      needIds.push(meta.id);
      continue;
    }
    if (meta.updatedAt > (localProject.cloudUpdatedAt ?? 0)) needIds.push(meta.id);
  }
  const contents = await fetchProjectContents(needIds);

  const projects: Project[] = [];
  const nodes: TopicNode[] = [];
  const edges: GraphEdge[] = [];
  const messages: Message[] = [];
  const toPush: Project[] = [];
  const warnings: string[] = [];
  let pulledCount = 0;

  for (const meta of metas) {
    knownRevisions.set(meta.id, meta.revision);
    const localProject = localById.get(meta.id);
    const content = contents.get(meta.id);

    if (content) {
      // 云端变过 → 采用云端版本
      const remote: RemoteProject = { ...meta, content };
      projects.push({
        ...projectFromRemote(remote),
        cloudRevision: meta.revision,
        cloudUpdatedAt: meta.updatedAt,
      });
      nodes.push(...content.nodes);
      edges.push(...content.edges);
      messages.push(...content.messages);
      pulledCount += 1;
    } else if (localProject) {
      // 云端没变 → 保留本地版本
      projects.push({ ...localProject, cloudRevision: meta.revision });
      const own = contentOf(local, localProject);
      nodes.push(...own.nodes);
      edges.push(...own.edges);
      messages.push(...own.messages);
      if (hasLocalChanges(localProject)) toPush.push(localProject);
    }
  }

  // 本地独有的项目 → 首次上传
  for (const localProject of local.projects) {
    if (metaById.has(localProject.id)) continue;
    projects.push(localProject);
    const own = contentOf(local, localProject);
    nodes.push(...own.nodes);
    edges.push(...own.edges);
    messages.push(...own.messages);
    toPush.push(localProject);
  }

  let settings = local.settings;
  if (remoteSettings) {
    settings = remoteSettings;
  } else {
    try {
      await pushSettings(local.settings);
    } catch {
      warnings.push('设置未能上传，稍后会自动重试。');
    }
  }

  let pushedCount = 0;
  const pushedInfo = new Map<string, { revision: number; updatedAt: number }>();
  for (const project of toPush) {
    const info = await pushOne(project, local, warnings);
    if (info) {
      pushedInfo.set(project.id, info);
      pushedCount += 1;
    }
  }

  return {
    snapshot: {
      projects: projects.map((p) => {
        const info = pushedInfo.get(p.id);
        return info
          ? { ...p, cloudRevision: info.revision, cloudUpdatedAt: info.updatedAt }
          : p;
      }),
      nodes,
      edges,
      messages,
      settings,
    },
    pulledCount,
    pushedCount,
    warnings,
  };
}

/** 日常增量：只推送本地有改动、且尚未上传的项目 */
export async function pushDirty(local: WorkspaceSnapshot): Promise<PushOutcome> {
  const warnings: string[] = [];
  const updated: PushOutcome['updated'] = [];

  for (const project of local.projects) {
    if (!hasLocalChanges(project)) continue;
    const info = await pushOne(project, local, warnings);
    if (info) updated.push({ id: project.id, ...info });
  }

  return { pushed: updated.length, warnings, updated };
}

export async function removeRemoteProject(projectId: string): Promise<void> {
  await deleteRemoteProjects([projectId]);
  knownRevisions.delete(projectId);
}

export async function syncSettingsToCloud(settings: Settings): Promise<void> {
  await pushSettings(settings);
}
