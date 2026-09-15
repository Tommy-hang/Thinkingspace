import type {
  GraphEdge,
  KnowledgeMap,
  Message,
  OpenQuestion,
  Project,
  Settings,
  TopicNode,
} from '../../types';
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

export interface RemoteProject {
  id: string;
  title: string;
  summary: string;
  revision: number;
  updatedAt: number;
  content: ProjectContent;
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

/** 拉取当前用户的全部项目和设置 */
export async function pullAll(): Promise<{
  projects: RemoteProject[];
  settings: Settings | null;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [projectsRes, settingsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id,title,summary,content,revision,updated_at')
      .order('updated_at', { ascending: false }),
    supabase.from('user_settings').select('settings').maybeSingle(),
  ]);

  if (projectsRes.error) throw new Error(projectsRes.error.message);

  const projects: RemoteProject[] = (projectsRes.data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    revision: Number(row.revision ?? 1),
    updatedAt: Date.parse(String(row.updated_at)) || Date.now(),
    content: parseContent(row.content),
  }));

  const settings =
    settingsRes.data && settingsRes.data.settings
      ? (settingsRes.data.settings as Settings)
      : null;

  return { projects, settings };
}

export type PushResult =
  | { status: 'created'; revision: number }
  | { status: 'updated'; revision: number }
  | { status: 'conflict'; remote: RemoteProject }
  | { status: 'error'; message: string }
  | { status: 'skipped' };

/**
 * 推送一个项目。
 * knownRevision 是本地"上次同步时云端是第几版"，用来发现别的设备是否改过。
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
      .select('revision')
      .maybeSingle();
    if (error) return { status: 'error', message: error.message };
    return { status: 'created', revision: Number(data?.revision ?? 1) };
  }

  const remoteRevision = Number(existing.revision ?? 1);
  if (knownRevision !== undefined && remoteRevision !== knownRevision) {
    return {
      status: 'conflict',
      remote: {
        id: String(existing.id),
        title: String(existing.title ?? ''),
        summary: String(existing.summary ?? ''),
        revision: remoteRevision,
        updatedAt: Date.parse(String(existing.updated_at)) || Date.now(),
        content: parseContent(existing.content),
      },
    };
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ ...base, revision: remoteRevision + 1 })
    .eq('id', project.id)
    .eq('revision', remoteRevision)
    .select('revision')
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!data) {
    return { status: 'error', message: '保存时版本已变化，请重试。' };
  }
  return { status: 'updated', revision: Number(data.revision) };
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
