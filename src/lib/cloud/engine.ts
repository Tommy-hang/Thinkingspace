// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { GraphEdge, Message, Project, Settings, TopicNode } from '../../types';
import { cloneProject, type ClonedProject } from '../projectTransfer';
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

/** 一次同步冲突：两边都改过同一个项目，落败的一方已被另存为副本 */
export interface SyncConflictInfo {
  projectId: string;
  title: string;
  /** 原项目最终保留的是哪一份 */
  kept: 'cloud' | 'local';
  copyProjectId: string;
  copyTitle: string;
  at: number;
}

export interface MergeOutcome {
  snapshot: WorkspaceSnapshot;
  pulledCount: number;
  pushedCount: number;
  warnings: string[];
  conflicts: SyncConflictInfo[];
}

export interface PushOutcome {
  pushed: number;
  warnings: string[];
  /** 推送成功后云端返回的版本信息，需要写回本地项目 */
  updated: { id: string; revision: number; updatedAt: number }[];
  conflicts: SyncConflictInfo[];
  /** 冲突时为「另一份」新建的本地副本，需要追加进本地数据 */
  cloned: ClonedProject[];
}

/** 给冲突副本起一个一眼能看懂的标题后缀 */
function conflictStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

interface PushOneResult {
  revision: number;
  updatedAt: number;
  conflict?: SyncConflictInfo;
  clone?: ClonedProject;
}

async function pushOne(
  project: Project,
  local: WorkspaceSnapshot,
  warnings: string[],
): Promise<PushOneResult | null> {
  const content = contentOf(local, project);
  const first = await pushProject(project, content, knownRevisions.get(project.id));

  if (first.status === 'created' || first.status === 'updated') {
    knownRevisions.set(project.id, first.revision);
    return { revision: first.revision, updatedAt: first.updatedAt };
  }

  if (first.status === 'conflict') {
    // 别的设备也改过 → 本机版本照常保存，另一份另存为本地副本，绝不静默丢弃
    const remoteProject = projectFromRemote(first.remote);
    const copyTitle = `${project.title} · 冲突副本 ${conflictStamp()}`;
    const clone = cloneProject(
      {
        projects: [remoteProject],
        nodes: first.remote.content.nodes,
        edges: first.remote.content.edges,
        messages: first.remote.content.messages,
      },
      remoteProject.id,
      { title: copyTitle },
    );

    const retry = await pushProject(project, content, first.remote.revision);
    if (retry.status === 'created' || retry.status === 'updated') {
      knownRevisions.set(project.id, retry.revision);
      warnings.push(
        `「${project.title}」在另一台设备上也被修改过。本机版本已保留，另一份已另存为「${copyTitle}」。`,
      );
      return {
        revision: retry.revision,
        updatedAt: retry.updatedAt,
        conflict: {
          projectId: project.id,
          title: project.title,
          kept: 'local',
          copyProjectId: clone?.project.id ?? '',
          copyTitle,
          at: Date.now(),
        },
        clone: clone ?? undefined,
      };
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
    return { snapshot: local, pulledCount: 0, pushedCount: 0, warnings: [], conflicts: [] };
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
  const conflicts: SyncConflictInfo[] = [];
  const conflictIds: string[] = [];
  let pulledCount = 0;

  for (const meta of metas) {
    knownRevisions.set(meta.id, meta.revision);
    const localProject = localById.get(meta.id);
    const content = contents.get(meta.id);

    if (content) {
      // 云端变过 → 采用云端版本
      if (localProject && hasLocalChanges(localProject)) {
        // 两边都改过 → 冲突。云端版本留在原项目，本机版本稍后另存为副本
        conflictIds.push(localProject.id);
      }
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

  // 冲突保底：把本机版本另存为副本，绝不静默丢弃
  for (const conflictId of conflictIds) {
    const source = localById.get(conflictId);
    if (!source) continue;
    const copyTitle = `${source.title} · 冲突副本 ${conflictStamp()}`;
    const clone = cloneProject(local, conflictId, { title: copyTitle });
    if (!clone) continue;
    projects.push(clone.project);
    nodes.push(...clone.nodes);
    edges.push(...clone.edges);
    messages.push(...clone.messages);
    conflicts.push({
      projectId: conflictId,
      title: source.title,
      kept: 'cloud',
      copyProjectId: clone.project.id,
      copyTitle,
      at: Date.now(),
    });
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
    if (!info) continue;
    pushedInfo.set(project.id, info);
    pushedCount += 1;
    if (info.conflict) conflicts.push(info.conflict);
    if (info.clone) {
      projects.push(info.clone.project);
      nodes.push(...info.clone.nodes);
      edges.push(...info.clone.edges);
      messages.push(...info.clone.messages);
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
    conflicts,
  };
}

/** 日常增量：只推送本地有改动、且尚未上传的项目 */
export async function pushDirty(local: WorkspaceSnapshot): Promise<PushOutcome> {
  const warnings: string[] = [];
  const updated: PushOutcome['updated'] = [];
  const conflicts: SyncConflictInfo[] = [];
  const cloned: ClonedProject[] = [];

  for (const project of local.projects) {
    if (!hasLocalChanges(project)) continue;
    const info = await pushOne(project, local, warnings);
    if (!info) continue;
    updated.push({ id: project.id, revision: info.revision, updatedAt: info.updatedAt });
    if (info.conflict) conflicts.push(info.conflict);
    if (info.clone) cloned.push(info.clone);
  }

  return { pushed: updated.length, warnings, updated, conflicts, cloned };
}

export async function removeRemoteProject(projectId: string): Promise<void> {
  await deleteRemoteProjects([projectId]);
  knownRevisions.delete(projectId);
}

export async function syncSettingsToCloud(settings: Settings): Promise<void> {
  await pushSettings(settings);
}
