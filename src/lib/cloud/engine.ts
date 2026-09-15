import type { GraphEdge, Message, Project, Settings, TopicNode } from '../../types';
import {
  deleteRemoteProjects,
  pullAll,
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

/** 记录每个项目「上次同步时云端的版本号」和「上次推送时的本地时间」 */
const knownRevisions = new Map<string, number>();
const lastPushedAt = new Map<string, number>();
let activeUserId: string | null = null;

export function resetCloudEngine(userId: string | null): void {
  knownRevisions.clear();
  lastPushedAt.clear();
  activeUserId = userId;
}

export function hasCloudSession(): boolean {
  return activeUserId !== null;
}

export function cloudSnapshotState(): { projects: number } {
  return { projects: lastPushedAt.size };
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
    cloudRevision: remote.revision,
  };
}

/**
 * 登录后的首次完整同步：
 * 逐个项目比较「云端更新时间」和「本地更新时间」，新的胜出；本地独有的项目上传。
 */
export async function fullSync(local: WorkspaceSnapshot): Promise<MergeOutcome> {
  const remote = await pullAll();
  if (!remote) {
    return { snapshot: local, pulledCount: 0, pushedCount: 0, warnings: [] };
  }

  const localById = new Map(local.projects.map((p) => [p.id, p]));
  const remoteIds = new Set(remote.projects.map((p) => p.id));

  const projects: Project[] = [];
  const nodes: TopicNode[] = [];
  const edges: GraphEdge[] = [];
  const messages: Message[] = [];
  const toPush: Project[] = [];
  const warnings: string[] = [];
  let pulledCount = 0;

  for (const remoteProject of remote.projects) {
    const localProject = localById.get(remoteProject.id);
    const remoteNewer = !localProject || remoteProject.updatedAt > localProject.updatedAt;
    knownRevisions.set(remoteProject.id, remoteProject.revision);

    if (remoteNewer) {
      projects.push(projectFromRemote(remoteProject));
      nodes.push(...remoteProject.content.nodes);
      edges.push(...remoteProject.content.edges);
      messages.push(...remoteProject.content.messages);
      lastPushedAt.set(remoteProject.id, remoteProject.updatedAt);
      pulledCount += 1;
    } else if (localProject) {
      projects.push(localProject);
      const content = contentOf(local, localProject);
      nodes.push(...content.nodes);
      edges.push(...content.edges);
      messages.push(...content.messages);
      toPush.push(localProject);
    }
  }

  for (const localProject of local.projects) {
    if (remoteIds.has(localProject.id)) continue;
    projects.push(localProject);
    const content = contentOf(local, localProject);
    nodes.push(...content.nodes);
    edges.push(...content.edges);
    messages.push(...content.messages);
    toPush.push(localProject);
  }

  let settings = local.settings;
  if (remote.settings) {
    settings = remote.settings;
  } else {
    try {
      await pushSettings(local.settings);
    } catch {
      warnings.push('设置未能上传，稍后会自动重试。');
    }
  }

  let pushedCount = 0;
  for (const project of toPush) {
    const outcome = await pushProject(
      project,
      contentOf(local, project),
      knownRevisions.get(project.id),
    );
    if (outcome.status === 'created' || outcome.status === 'updated') {
      knownRevisions.set(project.id, outcome.revision);
      lastPushedAt.set(project.id, project.updatedAt);
      pushedCount += 1;
    } else if (outcome.status === 'conflict') {
      const retry = await pushProject(project, contentOf(local, project), outcome.remote.revision);
      if (retry.status === 'created' || retry.status === 'updated') {
        knownRevisions.set(project.id, retry.revision);
        lastPushedAt.set(project.id, project.updatedAt);
        pushedCount += 1;
        warnings.push(`「${project.title}」在别处也被修改过，已按本地版本保存。`);
      } else {
        warnings.push(`「${project.title}」同步失败，稍后会自动重试。`);
      }
    } else if (outcome.status === 'error') {
      warnings.push(`「${project.title}」：${outcome.message}`);
    }
  }

  return {
    snapshot: { projects, nodes, edges, messages, settings },
    pulledCount,
    pushedCount,
    warnings,
  };
}

/** 日常增量：只推送本地有变化的项目 */
export async function pushDirty(
  local: WorkspaceSnapshot,
): Promise<{ pushed: number; warnings: string[] }> {
  const warnings: string[] = [];
  let pushed = 0;

  for (const project of local.projects) {
    const last = lastPushedAt.get(project.id) ?? 0;
    if (project.updatedAt <= last) continue;

    const outcome = await pushProject(
      project,
      contentOf(local, project),
      knownRevisions.get(project.id),
    );

    if (outcome.status === 'created' || outcome.status === 'updated') {
      knownRevisions.set(project.id, outcome.revision);
      lastPushedAt.set(project.id, project.updatedAt);
      pushed += 1;
    } else if (outcome.status === 'conflict') {
      const retry = await pushProject(project, contentOf(local, project), outcome.remote.revision);
      if (retry.status === 'created' || retry.status === 'updated') {
        knownRevisions.set(project.id, retry.revision);
        lastPushedAt.set(project.id, project.updatedAt);
        pushed += 1;
        warnings.push(`「${project.title}」在别处也被修改过，已按本地版本保存。`);
      }
    } else if (outcome.status === 'error') {
      warnings.push(`「${project.title}」：${outcome.message}`);
    }
  }

  return { pushed, warnings };
}

export async function removeRemoteProject(projectId: string): Promise<void> {
  await deleteRemoteProjects([projectId]);
  knownRevisions.delete(projectId);
  lastPushedAt.delete(projectId);
}

export async function syncSettingsToCloud(settings: Settings): Promise<void> {
  await pushSettings(settings);
}

export function markProjectPushed(projectId: string, updatedAt: number, revision?: number): void {
  lastPushedAt.set(projectId, updatedAt);
  if (revision !== undefined) knownRevisions.set(projectId, revision);
}
