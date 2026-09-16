// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { formatBytes, summarizeUsage, USAGE_LIMITS } from '../lib/usage';
import { IconCheck, IconGitHub, IconInfo, IconRefresh, IconTrash } from './icons';

const STATUS_TEXT: Record<string, string> = {
  disabled: '未启用',
  'signed-out': '未登录',
  syncing: '同步中…',
  synced: '已同步',
  error: '同步出错',
};

export function AuthPanel() {
  const open = useStore((s) => s.authOpen);
  const setOpen = useStore((s) => s.setAuthOpen);
  const cloudStatus = useStore((s) => s.cloudStatus);
  const cloudUser = useStore((s) => s.cloudUser);
  const cloudNotice = useStore((s) => s.cloudNotice);
  const cloudSignIn = useStore((s) => s.cloudSignIn);
  const cloudSignInGitHub = useStore((s) => s.cloudSignInGitHub);
  const cloudSignUp = useStore((s) => s.cloudSignUp);
  const cloudSignOut = useStore((s) => s.cloudSignOut);
  const cloudSyncNow = useStore((s) => s.cloudSyncNow);
  const cloudSendReset = useStore((s) => s.cloudSendReset);
  const cloudDeleteAccount = useStore((s) => s.cloudDeleteAccount);
  const setCloudNotice = useStore((s) => s.setCloudNotice);
  const setPrivacyOpen = useStore((s) => s.setPrivacyOpen);
  const projects = useStore((s) => s.projects);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const messages = useStore((s) => s.messages);
  const syncConflicts = useStore((s) => s.syncConflicts);
  const dismissConflicts = useStore((s) => s.dismissConflicts);
  const setActiveProject = useStore((s) => s.setActiveProject);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState('');
  const [alsoClearLocal, setAlsoClearLocal] = useState(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const usage = useMemo(
    () => summarizeUsage(projects, nodes, edges, messages),
    [projects, nodes, edges, messages],
  );

  useEffect(() => {
    if (!open) {
      setInfo(null);
      setCloudNotice(null);
    }
  }, [open, setCloudNotice]);

  const submit = async () => {
    setInfo(null);
    setCloudNotice(null);
    const mail = email.trim();
    if (!mail || !password) {
      setCloudNotice('请填写邮箱和密码。');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 8) {
        setCloudNotice('密码至少 8 位。');
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setCloudNotice('密码需要同时包含字母和数字。');
        return;
      }
      if (password !== confirm) {
        setCloudNotice('两次输入的密码不一致。');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await cloudSignIn(mail, password);
        setInfo('登录成功，已开始同步。');
      } else {
        const result = await cloudSignUp(mail, password);
        if (result.needsEmailConfirm) {
          setInfo('注册成功！请到邮箱点击确认链接，然后回来登录。');
          setMode('signin');
        } else {
          setInfo('注册成功，已自动登录并开始同步。');
        }
      }
      setPassword('');
      setConfirm('');
    } catch {
      /* 错误已写入 cloudNotice */
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const mail = email.trim();
    if (!mail) {
      setCloudNotice('请先填写邮箱，再点「忘记密码」。');
      return;
    }
    setBusy(true);
    try {
      await cloudSendReset(mail);
      setInfo('重置链接已发送到你的邮箱，请查收。');
    } catch (err) {
      setCloudNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteError(null);
    if (!cloudUser) return;
    if (deleteDraft.trim().toLowerCase() !== cloudUser.email.toLowerCase()) {
      setDeleteError('输入的邮箱与当前账号不一致，请重新输入。');
      return;
    }
    setBusy(true);
    try {
      await cloudDeleteAccount(alsoClearLocal);
      setDeleteOpen(false);
      setDeleteDraft('');
      setInfo('账号与云端数据已删除。');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      title={cloudUser ? '我的账号' : '登录 / 注册'}
      onClose={() => setOpen(false)}
      width={460}
    >
      {cloudStatus === 'disabled' ? (
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          当前版本<strong>未启用云端</strong>，所有内容只保存在这台设备的浏览器里。
          <br />
          如果你希望换电脑也能看到自己的思考，请联系站点维护者配置云端服务。
        </p>
      ) : cloudUser ? (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl p-3.5"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="mb-1 text-[11px]" style={{ color: 'var(--faint)' }}>
              已登录
            </div>
            <div className="text-[14px] font-medium">{cloudUser.email}</div>
            <div className="mt-2 flex items-center gap-2 text-[12px]">
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
              <span style={{ color: 'var(--muted)' }}>
                {STATUS_TEXT[cloudStatus] ?? cloudStatus}
              </span>
            </div>
          </div>

          <div className="rounded-xl p-3.5" style={{ border: '1px solid var(--border)' }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--faint)' }}>
                云端用量（按本机内容估算）
              </span>
            </div>

            <UsageBar
              label="项目数"
              ratio={usage.projects / USAGE_LIMITS.maxProjects}
              text={`${usage.projects} / ${USAGE_LIMITS.maxProjects} 个`}
            />
            <UsageBar
              label="内容总量"
              ratio={usage.totalBytes / USAGE_LIMITS.maxTotalBytes}
              text={`${formatBytes(usage.totalBytes)} / ${formatBytes(USAGE_LIMITS.maxTotalBytes)}`}
            />

            {usage.largest && (
              <div
                className="mt-1.5 text-[11px] leading-relaxed"
                style={{ color: 'var(--faint)' }}
              >
                最大的项目：「{usage.largest.title}」{formatBytes(usage.largest.bytes)}
                （单项目上限 {formatBytes(USAGE_LIMITS.maxProjectBytes)}）
              </div>
            )}
          </div>

          {syncConflicts.length > 0 && (
            <div
              className="rounded-xl p-3.5"
              style={{
                border: '1px solid color-mix(in srgb, #f59e0b 40%, transparent)',
                background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
              }}
            >
              <div
                className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold"
                style={{ color: '#b45309' }}
              >
                <IconInfo width={14} height={14} />
                同步冲突 · {syncConflicts.length}
              </div>
              <p className="mb-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                两台设备修改了同一份内容。我们<strong>没有覆盖任何一边</strong>，
                而是把另一份另存成了新的项目。你可以打开它、整理后删掉不需要的那份。
              </p>
              <div className="flex flex-col gap-1.5">
                {syncConflicts.map((c, i) => (
                  <div
                    key={`${c.projectId}-${c.copyProjectId}-${i}`}
                    className="rounded-lg p-2.5"
                    style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
                  >
                    <div className="text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>
                      「{c.title}」{c.kept === 'cloud' ? '保留了云端版本' : '保留了本机版本'}，
                      另一份已另存为「{c.copyTitle}」。
                    </div>
                    {c.copyProjectId && (
                      <button
                        className="btn btn-outline mt-2 !px-2 !py-0.5 !text-[11.5px]"
                        onClick={() => {
                          setActiveProject(c.copyProjectId);
                          setOpen(false);
                        }}
                      >
                        打开副本
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="btn btn-ghost mt-2 !px-2 !py-0.5 !text-[11.5px]"
                onClick={dismissConflicts}
              >
                知道了，收起提示
              </button>
            </div>
          )}

          {cloudNotice && (
            <div
              className="rounded-lg px-3 py-2 text-[12px] leading-relaxed"
              style={{
                background: 'color-mix(in srgb, #dc2626 10%, transparent)',
                border: '1px solid color-mix(in srgb, #dc2626 30%, transparent)',
                color: '#b91c1c',
              }}
            >
              {cloudNotice}
            </div>
          )}

          {info && (
            <div
              className="rounded-lg px-3 py-2 text-[12px] leading-relaxed"
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {info}
            </div>
          )}

          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            你的项目会自动同步到云端。换一台电脑登录同一个邮箱，就能看到同一份内容。
            <br />
            离线时也能正常使用，恢复网络后会自动补传。
          </p>

          <div className="flex justify-end gap-2">
            <button
              className="btn btn-ghost"
              disabled={busy || cloudStatus === 'syncing'}
              onClick={() => void cloudSyncNow()}
            >
              <IconRefresh width={14} height={14} />
              立即同步
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                void cloudSignOut();
                setInfo('已退出登录，当前设备回到本地模式。');
              }}
            >
              退出登录
            </button>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ border: '1px solid color-mix(in srgb, #dc2626 40%, transparent)' }}
          >
            <div className="mb-1 text-[13px] font-semibold" style={{ color: '#dc2626' }}>
              删除账号
            </div>
            <p className="mb-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              永久删除你的账号，以及云端保存的全部项目。此操作不可恢复，建议先导出备份。
            </p>
            <button
              className="btn"
              style={{ border: '1px solid #dc2626', color: '#dc2626' }}
              onClick={() => {
                setDeleteDraft('');
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              <IconTrash width={14} height={14} />
              删除我的账号
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            className="btn w-full !py-2.5 !text-[13.5px] font-medium"
            style={{
              background: '#24292f',
              color: '#ffffff',
              border: '1px solid #24292f',
            }}
            disabled={busy || cloudStatus === 'syncing'}
            onClick={() => void cloudSignInGitHub()}
          >
            <IconGitHub width={17} height={17} />
            使用 GitHub 账号登录
          </button>

          <p className="text-center text-[11.5px]" style={{ color: 'var(--faint)' }}>
            推荐：不用记密码，也不用收验证邮件，点一下授权即可
          </p>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
            <span className="text-[11px]" style={{ color: 'var(--faint)' }}>
              或使用邮箱
            </span>
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>

          <div className="flex gap-1.5">
            {(['signin', 'signup'] as const).map((value) => (
              <button
                key={value}
                className="btn !px-3 !py-1 !text-[12.5px]"
                style={{
                  border: `1px solid ${
                    mode === value ? 'var(--accent)' : 'var(--border)'
                  }`,
                  background:
                    mode === value
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                  color: mode === value ? 'var(--accent)' : 'var(--muted)',
                }}
                onClick={() => {
                  setMode(value);
                  setCloudNotice(null);
                  setInfo(null);
                }}
              >
                {value === 'signin' ? '登录' : '注册新账号'}
              </button>
            ))}
          </div>

          <label className="text-[12px]" style={{ color: 'var(--muted)' }}>
            邮箱
            <input
              className="input mt-1"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="text-[12px]" style={{ color: 'var(--muted)' }}>
            密码
            <input
              className="input mt-1"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signup' ? '至少 8 位，含字母和数字' : ''}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && mode === 'signin') void submit();
              }}
            />
          </label>

          {mode === 'signup' && (
            <label className="text-[12px]" style={{ color: 'var(--muted)' }}>
              再输入一次密码
              <input
                className="input mt-1"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />
            </label>
          )}

          {cloudNotice && (
            <div
              className="rounded-lg px-3 py-2 text-[12px] leading-relaxed"
              style={{
                background: 'color-mix(in srgb, #dc2626 10%, transparent)',
                border: '1px solid color-mix(in srgb, #dc2626 30%, transparent)',
                color: '#b91c1c',
              }}
            >
              {cloudNotice}
            </div>
          )}

          {info && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
                color: 'var(--accent)',
              }}
            >
              <IconCheck width={13} height={13} />
              <span>{info}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              className="btn btn-ghost !px-2 !text-[12px]"
              disabled={busy}
              onClick={() => void resetPassword()}
            >
              忘记密码
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
              {busy ? '处理中…' : mode === 'signin' ? '登录' : '注册'}
            </button>
          </div>

          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            <div className="flex-1">
              登录后，你的项目会同步到云端，<strong>只有你自己能看到</strong>。
              不登录也可以继续本地使用，内容只保存在这台设备。
              <br />
              AI 的 API Key 始终只保存在你自己的浏览器里，不会上传。
            </div>
            <button
              className="btn btn-ghost shrink-0 !px-2 !py-0.5 !text-[11.5px]"
              style={{ color: 'var(--accent)' }}
              onClick={() => setPrivacyOpen(true)}
            >
              隐私说明
            </button>
          </div>
        </div>
      )}
    </Modal>

    {deleteOpen && cloudUser && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: 'rgba(9,9,11,0.5)' }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setDeleteOpen(false);
        }}
      >
        <div
          className="panel ts-fade-up w-full max-w-[420px] rounded-2xl p-5"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          <h3 className="mb-2 text-sm font-semibold" style={{ color: '#dc2626' }}>
            确认删除账号
          </h3>
          <p className="mb-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            这会永久删除{' '}
            <strong style={{ color: 'var(--text)' }}>{cloudUser.email}</strong>{' '}
            的账号，以及云端保存的全部项目与设置，<strong>无法恢复</strong>。
          </p>

          <label className="mb-1 block text-[12px]" style={{ color: 'var(--muted)' }}>
            请输入你的邮箱以确认：
          </label>
          <input
            className="input mb-3"
            autoFocus
            placeholder={cloudUser.email}
            value={deleteDraft}
            onChange={(e) => setDeleteDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmDelete();
            }}
          />

          <button
            className="mb-3 flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[12px] leading-relaxed"
            style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
            }}
            onClick={() => setAlsoClearLocal((v) => !v)}
          >
            <span
              className="mt-[2px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px]"
              style={{
                border: `1px solid ${alsoClearLocal ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: alsoClearLocal ? 'var(--accent)' : 'transparent',
              }}
            >
              {alsoClearLocal && <IconCheck width={10} height={10} />}
            </span>
            <span className="flex-1">
              同时清除这台设备上的数据（推荐，避免以后登录新账号时又上传回去）
            </span>
          </button>

          {deleteError && (
            <div
              className="mb-3 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
              style={{
                background: 'color-mix(in srgb, #dc2626 10%, transparent)',
                border: '1px solid color-mix(in srgb, #dc2626 30%, transparent)',
                color: '#b91c1c',
              }}
            >
              {deleteError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="btn"
              disabled={
                busy || deleteDraft.trim().toLowerCase() !== cloudUser.email.toLowerCase()
              }
              style={{
                border: '1px solid #dc2626',
                background: '#dc2626',
                color: '#ffffff',
                opacity:
                  busy || deleteDraft.trim().toLowerCase() !== cloudUser.email.toLowerCase()
                    ? 0.5
                    : 1,
              }}
              onClick={() => void confirmDelete()}
            >
              {busy ? '删除中…' : '永久删除'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function UsageBar({ label, ratio, text }: { label: string; ratio: number; text: string }) {
  const pct = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const warn = pct >= 0.8;
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ color: warn ? '#dc2626' : 'var(--muted)' }}>{text}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            background: warn ? '#dc2626' : 'var(--accent)',
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  );
}
