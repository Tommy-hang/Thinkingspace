import type {
  GraphEdge,
  KnowledgeMap,
  Message,
  OpenQuestion,
  Project,
  Settings,
  TopicNode,
} from '../../types';
import { migrateOpenQuestions } from '../storage';
import { getSupabase } from './client';

/** 一个项目的全部内容（对应数据库里的 content 字段） */
export interface ProjectContent {
  createdAt: number;
  nodes: TopicNode[];
  edges: GraphEdge[];
  messages: Message[];
  openQuestions?: OpenQuestion[];
  knowledgeMap?: KnowledgeMap;
}

/** 项目元信息（不含内容，用于「按需加载」时先判断哪些需要拉取） */
export interface RemoteProjectMeta {
  id: string;
  title: string;
  summary: string;
  revision: number;
  updatedAt: number;
}

export interface RemoteProject extends RemoteProjectMeta {
  content: ProjectContent;
}

function emptyContent(): ProjectContent {
  return { createdAt: Date.now(), nodes: [], edges: [], messages: [] };
}

function parseContent(raw: unknown): ProjectContent {
  const value = (raw ?? {}) as Partial<ProjectContent>;
  return {
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    edges: Array.isArray(value.edges) ? value.edges : [],
    messages: Array.isArray(value.messages) ? value.messages : [],
    openQuestions: Array.isArray(value.openQuestions) ? value.openQuestions : undefined,
    knowledgeMap: value.knowledgeMap,
  };
}

/** 云端数据也要经过迁移，保证旧版本存下的内容能被新版本正确读取 */
function toRemoteProject(meta: RemoteProjectMeta, content: ProjectContent): RemoteProject {
  const draft: Project = {
    id: meta.id,
    title: meta.title,
    summary: meta.summary,
    createdAt: content.createdAt,
    updatedAt: meta.updatedAt,
    openQuestions: content.openQuestions,
    knowledgeMap: content.knowledgeMap,
  };
  const migrated = migrateOpenQuestions([draft], content.nodes);
  const project = migrated.projects[0] ?? draft;

  return {
    id: project.id,
    title: project.title,
    summary: project.summary,
    revision: meta.revision,
    updatedAt: project.updatedAt,
    content: {
      ...content,
      nodes: migrated.nodes,
      openQuestions: project.openQuestions,
    },
  };
}

/** 只拉元信息：很小，几乎不耗流量 */
export async function pullProjectMetas(): Promise<RemoteProjectMeta[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('projects')
    .select('id,title,summary,revision,updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    revision: Number(row.revision ?? 1),
    updatedAt: Date.parse(String(row.updated_at)) || Date.now(),
  }));
}

/** 只拉指定项目的内容：这才是流量大头，尽量少调 */
export async function fetchProjectContents(
  ids: string[],
): Promise<Map<string, ProjectContent>> {
  const result = new Map<string, ProjectContent>();
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return result;

  const { data, error } = await supabase.from('projects').select('id,content').in('id', ids);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    result.set(String(row.id), parseContent(row.content));
  }
  return result;
}

export async function pullSettings(): Promise<Settings | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from('user_settings').select('settings').maybeSingle();
  return data && data.settings ? (data.settings as Settings) : null;
}

/** 拉取全部项目（含内容）。主要用于完整备份/诊断，日常同步走「按需加载」 */
export async function pullAll(): Promise<{
  projects: RemoteProject[];
  settings: Settings | null;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [metas, settings] = await Promise.all([pullProjectMetas(), pullSettings()]);
  const list = metas ?? [];
  const contents = await fetchProjectContents(list.map((m) => m.id));

  return {
    projects: list.map((meta) => toRemoteProject(meta, contents.get(meta.id) ?? emptyContent())),
    settings,
  };
}

export type PushResult =
  | { status: 'created'; revision: number; updatedAt: number }
  | { status: 'updated'; revision: number; updatedAt: number }
  | { status: 'conflict'; remote: RemoteProject }
  | { status: 'error'; message: string }
  | { status: 'skipped' };

function toMillis(value: unknown): number {
  return Date.parse(String(value)) || Date.now();
}

/**
 * 推送一个项目。
 * knownRevision 是本地「上次同步时云端是第几版」，用来发现别的设备是否改过。
 */
export async function pushProject(
  project: Project,
  content: ProjectContent,
  knownRevision: number | undefined,
): Promise<PushResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: 'skipped' };

  const base = {
    id: project.id,
    title: project.title,
    summary: project.summary,
    content,
  };

  const { data: existing, error: readError } = await supabase
    .from('projects')
    .select('id,title,summary,content,revision,updated_at')
    .eq('id', project.id)
    .maybeSingle();

  if (readError) return { status: 'error', message: readError.message };

  if (!existing) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...base, revision: 1 })
      .select('revision,updated_at')
      .maybeSingle();
    if (error) return { status: 'error', message: error.message };
    return {
      status: 'created',
      revision: Number(data?.revision ?? 1),
      updatedAt: toMillis(data?.updated_at),
    };
  }

  const remoteRevision = Number(existing.revision ?? 1);
  if (knownRevision !== undefined && remoteRevision !== knownRevision) {
    return {
      status: 'conflict',
      remote: toRemoteProject(
        {
          id: String(existing.id),
          title: String(existing.title ?? ''),
          summary: String(existing.summary ?? ''),
          revision: remoteRevision,
          updatedAt: toMillis(existing.updated_at),
        },
        parseContent(existing.content),
      ),
    };
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ ...base, revision: remoteRevision + 1 })
    .eq('id', project.id)
    .eq('revision', remoteRevision)
    .select('revision,updated_at')
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'error', message: '保存时版本已变化，请重试。' };

  return {
    status: 'updated',
    revision: Number(data.revision),
    updatedAt: toMillis(data.updated_at),
  };
}

export async function deleteRemoteProjects(ids: string[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase.from('projects').delete().in('id', ids);
  if (error) throw new Error(error.message);
}

export async function pushSettings(settings: Settings): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, settings }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}
