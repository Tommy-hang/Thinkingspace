import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { IconCheck, IconRefresh } from './icons';

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
  const cloudSignUp = useStore((s) => s.cloudSignUp);
  const cloudSignOut = useStore((s) => s.cloudSignOut);
  const cloudSyncNow = useStore((s) => s.cloudSyncNow);
  const cloudSendReset = useStore((s) => s.cloudSendReset);
  const setCloudNotice = useStore((s) => s.setCloudNotice);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

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
      if (password.length < 6) {
        setCloudNotice('密码至少 6 位。');
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

  return (
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
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
              placeholder={mode === 'signup' ? '至少 6 位' : ''}
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

          <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
            登录后，你的项目会同步到云端。不登录也可以继续本地使用，内容只保存在这台设备。
            <br />
            AI 的 API Key 始终只保存在你自己的浏览器里，不会上传。
          </p>
        </div>
      )}
    </Modal>
  );
}
