import { useStore } from '../store/store';
import { IconCloud, IconX } from './icons';

/**
 * 未登录时的轻提示：说明「不用注册也能用」，以及内容存在哪。
 * 登录后自动消失；用户关掉后不再出现。
 */
export function GuestBanner() {
  const cloudStatus = useStore((s) => s.cloudStatus);
  const cloudUser = useStore((s) => s.cloudUser);
  const dismissed = useStore((s) => s.guestBannerDismissed);
  const dismiss = useStore((s) => s.dismissGuestBanner);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  if (cloudStatus === 'disabled' || cloudUser || dismissed) return null;

  return (
    <div
      className="ts-banner flex shrink-0 items-center gap-2 px-3 py-1.5 text-[11.5px] md:h-[30px] md:py-0"
      style={{
        background: 'var(--accent-soft)',
        color: 'var(--muted)',
        borderBottom: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
      }}
    >
      <IconCloud width={13} height={13} className="shrink-0" />
      <span className="truncate md:hidden">
        <strong style={{ color: 'var(--accent)' }}>本机模式</strong>：内容只存在这台设备
      </span>
      <span className="hidden truncate md:inline">
        现在是<strong style={{ color: 'var(--accent)' }}>本机模式</strong>
        ：内容只保存在这台设备的浏览器里，别人看不到。
      </span>
      <span className="hidden lg:inline" style={{ color: 'var(--faint)' }}>
        注册后可以跨设备同步；也可以随时「导出」备份。
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          className="btn btn-ghost !px-2 !py-0 !text-[11.5px]"
          style={{ color: 'var(--accent)' }}
          onClick={() => setAuthOpen(true)}
        >
          <span className="hidden sm:inline">注册 / 登录</span>
          <span className="sm:hidden">登录</span>
        </button>
        <button
          className="btn btn-ghost !px-1.5 !py-0"
          style={{ color: 'var(--faint)' }}
          title="不再提示"
          onClick={dismiss}
        >
          <IconX width={12} height={12} />
        </button>
      </div>
    </div>
  );
}
