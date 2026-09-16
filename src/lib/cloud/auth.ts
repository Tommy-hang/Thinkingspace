import { getSupabase } from './client';

export interface CloudUser {
  id: string;
  email: string;
}

function toUser(session: { user: { id: string; email?: string | null } } | null): CloudUser | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? '' };
}

export async function getCurrentUser(): Promise<CloudUser | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return toUser(data.session);
}

export interface SignUpResult {
  user: CloudUser | null;
  /** 需要去邮箱点确认链接后才能登录 */
  needsEmailConfirm: boolean;
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('云端未配置');

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  return {
    user: toUser(data.session),
    needsEmailConfirm: !data.session,
  };
}

export async function signInWithPassword(email: string, password: string): Promise<CloudUser> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('云端未配置');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const user = toUser(data.session);
  if (!user) throw new Error('登录失败，请稍后重试。');
  return user;
}

/**
 * 使用 GitHub 账号登录。
 * 会跳转到 GitHub 授权页，回来后 supabase-js 自动把会话写进 URL，
 * 由 onAuthStateChange 接管。
 */
export async function signInWithGitHub(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('云端未配置');

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo, scopes: 'read:user user:email' },
  });
  if (error) throw new Error(error.message);
}

export async function signOutCloud(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('云端未配置');

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

/**
 * 删除当前登录的账号。
 *
 * 前端没有权限直接删 auth 用户，所以调用数据库里的 `delete_my_account()` 函数
 * （见 `supabase/schema.sql`，它用 security definer + auth.uid() 保证只能删自己）。
 * 项目与设置通过外键 `on delete cascade` 自动一起删除。
 */
export async function deleteMyAccount(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('云端未配置');

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}

export function onAuthChange(callback: (user: CloudUser | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(toUser(session));
  });
  return () => data.subscription.unsubscribe();
}
