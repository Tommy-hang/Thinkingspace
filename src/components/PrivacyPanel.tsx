import type { ReactNode } from 'react';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { IconCheck, IconX } from './icons';

function Section({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {index}
        </span>
        {title}
      </h3>
      <div className="flex flex-col gap-2 pl-7 text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        {children}
      </div>
    </section>
  );
}

function Bullet({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-[2px] shrink-0"
        style={{ color: ok ? '#16a34a' : '#dc2626' }}
      >
        {ok ? <IconCheck width={13} height={13} /> : <IconX width={13} height={13} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

export function PrivacyPanel() {
  const open = useStore((s) => s.privacyOpen);
  const setOpen = useStore((s) => s.setPrivacyOpen);

  return (
    <Modal open={open} title="隐私说明" onClose={() => setOpen(false)} width={700}>
      <div
        className="mb-5 rounded-xl px-4 py-3.5"
        style={{
          background: 'var(--accent-soft)',
          border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
        }}
      >
        <div className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
          一句话承诺
        </div>
        <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>
          你的思考只属于你。我们<strong>不收集</strong>、<strong>不分析</strong>、<strong>不分享</strong>。
        </div>
      </div>

      <Section index={1} title="我们不做什么">
        <Bullet ok={false}>不做用户行为追踪、不埋点</Bullet>
        <Bullet ok={false}>不做用户画像、不分析你的使用习惯</Bullet>
        <Bullet ok={false}>没有广告、没有第三方统计工具</Bullet>
        <Bullet ok={false}>不会把你的对话内容用于任何其他目的</Bullet>
      </Section>

      <Section index={2} title="你的数据存在哪里">
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'var(--panel-2)' }}>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text)' }}>
                  使用方式
                </th>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text)' }}>
                  数据位置
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-1.5">不登录直接使用</td>
                <td className="px-3 py-1.5">
                  <strong>只在你自己的浏览器里</strong>，从不上传
                </td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-1.5">用 GitHub 或邮箱登录</td>
                <td className="px-3 py-1.5">
                  浏览器 + 云端数据库（Supabase，服务器在新加坡 / 东京）
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section index={3} title="谁能看到你的数据">
        <p>
          <strong style={{ color: 'var(--text)' }}>只有你。</strong>
          云端数据库启用了「行级安全」（Row Level Security），这是<strong>数据库层面</strong>的强制隔离，
          不是靠前端隐藏：
        </p>
        <Bullet ok>数据库会校验你的身份，只返回属于你的数据</Bullet>
        <Bullet ok>即使有人拿到公开的访问密钥，也只能看到「他自己」的数据</Bullet>
        <Bullet ok>
          这一点做过实际测试：用账号 B 尝试读取账号 A 的数据，被数据库直接拒绝（HTTP 403）
        </Bullet>
      </Section>

      <Section index={4} title="你的 API Key 怎么处理">
        <p>
          你填写的 DeepSeek / Tavily 等服务的 API Key：
        </p>
        <Bullet ok>只保存在<strong>你自己的浏览器</strong>里</Bullet>
        <Bullet ok><strong>从不上传</strong>到任何服务器</Bullet>
        <Bullet ok>不参与导出，也不会进入公开的代码仓库</Bullet>
      </Section>

      <Section index={5} title="你的对话会发送给谁">
        <p>
          当你提问时，内容会发送给<strong>你自己配置的 AI 服务商</strong>（例如 DeepSeek）。
          这是使用 AI 的必要步骤，这些服务商有各自的隐私政策。
        </p>
        <p>如果你开启了「联网搜索」，你的问题也会发送给你选择的搜索服务商。</p>
      </Section>

      <Section index={6} title="你的权利">
        <Bullet ok><strong>随时导出</strong>：顶部下载图标 → 导出全部项目，得到完整 JSON 文件</Bullet>
        <Bullet ok><strong>随时清除本机数据</strong>：设置 → 危险操作</Bullet>
        <Bullet ok><strong>随时退出登录</strong>：账号面板 → 退出登录（本机数据保留）</Bullet>
        <Bullet ok><strong>删除账号</strong>：联系站点维护者，会连同云端数据一并删除</Bullet>
      </Section>

      <Section index={7} title="开源透明">
        <p>
          这个项目的<strong>全部代码</strong>都公开在 GitHub 上，你可以自己审查，或者请懂技术的朋友帮你看：
        </p>
        <a
          href="https://github.com/Tommy-hang/Thinkingspace"
          target="_blank"
          rel="noreferrer noopener"
          className="break-all"
          style={{ color: 'var(--accent)' }}
        >
          https://github.com/Tommy-hang/Thinkingspace
        </a>
      </Section>

      <Section index={8} title="技术上的保障">
        <Bullet ok>所有网络传输都使用 <strong>HTTPS 加密</strong></Bullet>
        <Bullet ok>密码由 Supabase Auth 处理，<strong>我们不接触明文密码</strong></Bullet>
        <Bullet ok>数据库权限在<strong>数据库层</strong>强制，前端无法绕过</Bullet>
        <Bullet ok>使用 GitHub 登录时，我们<strong>只能看到你的公开资料和邮箱</strong>，无法访问你的仓库</Bullet>
      </Section>

      <Section index={9} title="诚实说明：我们做不到的">
        <Bullet ok={false}>
          <strong>免费版没有自动备份。</strong>
          如果数据库发生故障，数据可能丢失。建议你定期导出保存。
        </Bullet>
        <Bullet ok={false}>
          <strong>站点维护者在技术上有数据库管理权限。</strong>
          虽然不会查看任何人的内容，但这是客观事实——这也是我们坚持开源的原因：代码可以被审查。
        </Bullet>
        <Bullet ok={false}>
          <strong>AI 服务商如何处理你的数据，不在我们的控制范围内。</strong>
          请参考对应服务商的隐私政策。
        </Bullet>
      </Section>

      <div
        className="rounded-xl px-4 py-3 text-center text-[13px]"
        style={{
          background: 'var(--panel-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        你的思考属于你。我们只是提供工具。
      </div>
    </Modal>
  );
}
