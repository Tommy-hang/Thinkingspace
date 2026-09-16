import type { ReactNode } from 'react';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { IconCheck, IconInfo, IconKey, IconX } from './icons';

function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {index}
        </span>
        {title}
      </h3>
      <div
        className="flex flex-col gap-2 pl-8 text-[12.5px] leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        {children}
      </div>
    </section>
  );
}

function Path({ children }: { children: ReactNode }) {
  return (
    <code
      className="rounded px-1.5 py-0.5 text-[11.5px]"
      style={{
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
      }}
    >
      {children}
    </code>
  );
}

function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const warn = tone === 'warn';
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
      style={{
        background: warn
          ? 'color-mix(in srgb, #f59e0b 10%, transparent)'
          : 'var(--panel-2)',
        border: `1px solid ${
          warn ? 'color-mix(in srgb, #f59e0b 38%, transparent)' : 'var(--border)'
        }`,
        color: 'var(--text)',
      }}
    >
      <span className="mt-[2px] shrink-0" style={{ color: warn ? '#b45309' : 'var(--faint)' }}>
        {warn ? <IconInfo width={13} height={13} /> : <IconCheck width={13} height={13} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

export function ApiKeyGuide() {
  const open = useStore((s) => s.apiKeyGuideOpen);
  const setOpen = useStore((s) => s.setApiKeyGuideOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  return (
    <Modal open={open} title="如何获取 API Key" onClose={() => setOpen(false)} width={720}>
      {/* 为什么要自己配 */}
      <div
        className="mb-6 rounded-xl px-4 py-3.5"
        style={{
          background: 'var(--accent-soft)',
          border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
        }}
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
          <IconKey width={15} height={15} />
          为什么需要你自己的 API Key？
        </div>
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>
          ThinkingSpace 本身<strong>不提供 AI 能力</strong>，它调用的是大模型服务商（默认是 DeepSeek）。
          所以你需要一把「钥匙」——也就是 API Key。
          <br />
          这样做的好处是：<strong>这个工具可以免费给你用</strong>，而且你的 Key
          只保存在你自己的浏览器里，站点看不到、也不会替你花钱。
        </div>
      </div>

      <Step index={1} title="注册 DeepSeek 账号">
        <div>
          在浏览器打开：{' '}
          <a
            href="https://platform.deepseek.com"
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: 'var(--accent)' }}
          >
            https://platform.deepseek.com
          </a>
        </div>
        <div>用<strong>手机号或邮箱</strong>注册，登录后进入控制台。</div>
        <Note>这是 DeepSeek 的开放平台（面向开发者），和网页版 chat.deepseek.com 是两个入口，不要走错。</Note>
      </Step>

      <Step index={2} title="充值（很少的钱就够用很久）">
        <div>左侧菜单找到 <Path>充值 / Top up</Path>，建议先充 <strong>10 元</strong>。</div>
        <div>
          费用参考：一次普通问答大约 <strong>几分钱</strong>。
          充 10 元通常够你问 <strong>1000 次以上</strong>。
        </div>
        <Note>
          不充值会报 <code>Insufficient Balance</code>（余额不足）。
          DeepSeek 按用量计费，用多少扣多少，不会自动续费。
        </Note>
      </Step>

      <Step index={3} title="创建 API Key（这一步最关键）">
        <div>左侧菜单点 <Path>API Keys</Path> → <Path>创建 API Key</Path>。</div>
        <div>给它起个名字，比如 <Path>thinkingspace</Path>，然后确认创建。</div>
        <Note tone="warn">
          创建后会显示一串以 <code>sk-</code> 开头的字符。
          <strong>它只会完整显示这一次</strong>，关掉页面就再也看不到了。
          请立刻复制，粘到记事本里存好。
          <br />
          如果忘了保存，只能删掉重新创建一个（不影响使用）。
        </Note>
      </Step>

      <Step index={4} title="填进 ThinkingSpace">
        <div>回到本网站，点右上角<strong>齿轮图标</strong>打开设置。</div>
        <div>找到 <Path>AI Providers</Path> 里的 <strong>DeepSeek</strong> 卡片。</div>
        <div>把刚才复制的 Key 粘贴到 <Path>API Key（仅存本机）</Path> 这一栏。</div>
        <div>点 DeepSeek 卡片右上角的 <Path>设为当前</Path>。</div>
        <div>关掉设置窗口，回到任意主题里提问即可。</div>
        <Note>
          成功的样子：AI 的回答<strong>一个字一个字地冒出来</strong>，
          并且内容不是「这是离线演示模式的回答」。
        </Note>
      </Step>

      <Step index={5} title="（可选）配置联网搜索">
        <div>
          想让 AI 能查最新信息，需要额外一个搜索服务的 Key。推荐 <strong>Tavily</strong>（每月有免费额度）：
        </div>
        <div>
          打开{' '}
          <a
            href="https://tavily.com"
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: 'var(--accent)' }}
          >
            https://tavily.com
          </a>{' '}
          注册 → 进入 Dashboard → 复制 API Key（以 <code>tvly-</code> 开头）。
        </div>
        <div>
          回到 ThinkingSpace → 设置 → <Path>联网搜索</Path> → Tavily 那一栏粘贴 → 点「设为当前」，
          并把右上角开关切到「已开启」。
        </div>
        <div>之后在对话输入框上方打开 🌐 开关，提问就会先检索网页。</div>
      </Step>

      <Step index={6} title="遇到问题怎么办">
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr style={{ background: 'var(--panel-2)' }}>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text)' }}>
                  报错里出现
                </th>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text)' }}>
                  原因与解决办法
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ['401 / Authentication', 'Key 填错了。回设置重新复制粘贴，注意不要多出空格。'],
                ['402 / Insufficient Balance', '余额不足。去 DeepSeek 充值。'],
                ['404 / model', '模型名不对。设置里把模型改成 deepseek-flash。'],
                ['Failed to fetch', '网络问题。确认能打开 deepseek 官网，必要时开代理。'],
                ['一直显示「未填 Key」', 'Key 没有保存成功，重新粘贴一次即可。'],
              ].map(([err, fix]) => (
                <tr key={err} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text)' }}>
                    {err}
                  </td>
                  <td className="px-3 py-1.5">{fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Step>

      <Step index={7} title="安全提示">
        <div className="flex items-start gap-2">
          <span className="mt-[3px] shrink-0" style={{ color: '#16a34a' }}>
            <IconCheck width={12} height={12} />
          </span>
          <span>Key 只保存在你自己的浏览器里，<strong>不会上传到任何服务器</strong>。</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-[3px] shrink-0" style={{ color: '#dc2626' }}>
            <IconX width={12} height={12} />
          </span>
          <span>不要截图发到群里、论坛或任何公开的地方。</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-[3px] shrink-0" style={{ color: '#dc2626' }}>
            <IconX width={12} height={12} />
          </span>
          <span>如果怀疑泄露，去 DeepSeek 后台把它删掉，重新创建一个即可。</span>
        </div>
      </Step>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="btn btn-outline"
          onClick={() => {
            setOpen(false);
            setSettingsOpen(true);
          }}
        >
          直接去设置里填写
        </button>
        <button className="btn btn-primary" onClick={() => setOpen(false)}>
          我知道了
        </button>
      </div>
    </Modal>
  );
}
