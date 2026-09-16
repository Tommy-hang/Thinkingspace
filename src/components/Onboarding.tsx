import { useState, type ReactNode } from 'react';
import { useStore } from '../store/store';
import {
  IconBranch,
  IconCheck,
  IconChevronLeft,
  IconGitHub,
  IconInfo,
  IconKey,
  IconMap,
  IconSpark,
  IconX,
} from './icons';

const TOTAL = 5;

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl p-3.5 text-[12.5px] leading-relaxed"
      style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  );
}

function Bad({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-[3px] shrink-0" style={{ color: '#dc2626' }}>
        <IconX width={12} height={12} />
      </span>
      <span style={{ color: 'var(--muted)' }}>{children}</span>
    </div>
  );
}

function Good({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-[3px] shrink-0" style={{ color: '#16a34a' }}>
        <IconCheck width={12} height={12} />
      </span>
      <span style={{ color: 'var(--muted)' }}>{children}</span>
    </div>
  );
}

function Concept({
  icon,
  name,
  children,
}: {
  icon: ReactNode;
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
          {name}
        </div>
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Onboarding() {
  const open = useStore((s) => s.onboardingOpen);
  const setOpen = useStore((s) => s.setOnboardingOpen);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const setApiKeyGuideOpen = useStore((s) => s.setApiKeyGuideOpen);
  const cloudStatus = useStore((s) => s.cloudStatus);

  const [step, setStep] = useState(0);

  if (!open) return null;

  const finish = () => {
    setStep(0);
    setOpen(false);
  };

  const startWithGitHub = () => {
    finish();
    setAuthOpen(true);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(9,9,11,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="panel ts-fade-up flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl"
        style={{ maxWidth: 720, boxShadow: 'var(--shadow-lg)' }}
      >
        {/* 顶部：进度 + 关闭 */}
        <div
          className="flex shrink-0 items-center gap-3 px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  background: i === step ? 'var(--accent)' : 'var(--border-strong)',
                }}
              />
            ))}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--faint)' }}>
            {step + 1} / {TOTAL}
          </span>
          <button
            className="btn btn-ghost ml-auto !px-2 !py-0.5 !text-[12px]"
            onClick={finish}
          >
            跳过
          </button>
        </div>

        {/* 内容 */}
        <div className="ts-scroll flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-1.5 text-[19px] leading-snug font-semibold">
                  AI 很强大，但「聊天框」拖了后腿
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  传统 AI 对话有一个结构性缺陷：
                  <strong style={{ color: 'var(--text)' }}>它是线性的，而思考不是。</strong>
                </p>
              </div>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  ① 局部问题污染主线
                </div>
                <div className="mb-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  你对回答里的某个词产生疑问，追问几轮之后，
                  <strong>原本正在读的内容早已滚出屏幕</strong>。
                </div>
                <div
                  className="rounded-lg px-3 py-2 font-mono text-[11.5px]"
                  style={{ background: 'var(--bg)', color: 'var(--muted)' }}
                >
                  正在读 Positional Encoding
                  <br />
                  ↓ 突然想问 QKV
                  <br />
                  ↓ 追问 5 轮
                  <br />
                  <span style={{ color: '#dc2626' }}>→ 主线已经找不到了</span>
                </div>
              </Card>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  ② 关系被压扁成顺序
                </div>
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  概念 A 下的问题 A1、A2，和概念 B 下的问题 B1，
                  在聊天记录里被压成一条直线：
                  <br />
                  <span className="font-mono text-[11.5px]">
                    A → A1 → A2 → B → B1
                  </span>
                  <br />
                  <strong>原本的从属关系消失了。</strong>
                </div>
              </Card>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  ③ 上下文越滚越脏
                </div>
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  传统做法把<strong>全部历史</strong>发给模型。轮次越多，
                  Token 越贵、噪声越大、模型的注意力越分散。
                </div>
              </Card>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-1.5 text-[19px] leading-snug font-semibold">
                  把对话从「一条线」变成「一张图」
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  ThinkingSpace 改变了最基本的单位：
                  <strong style={{ color: 'var(--text)' }}>不再是消息，而是主题。</strong>
                </p>
              </div>

              <Card>
                <Concept
                  icon={<IconSpark width={15} height={15} />}
                  name="Topic · 主题卡片"
                >
                  一个认知主题 = <strong>一张卡片</strong>，而不是一条消息。
                  卡片内部可以有很多轮对话，但它们<strong>不会污染别的主题</strong>。
                  <br />
                  所以地图始终反映「你思考了哪些问题」，而不是「你说了多少话」。
                </Concept>
              </Card>

              <Card>
                <Concept
                  icon={<IconBranch width={15} height={15} />}
                  name="Branch · 分支"
                >
                  在 AI 回答里<strong>选中任意一句话</strong>，就能从它生长出一个新的子主题。
                  <br />
                  分支会记住它来自哪句话（锚点），
                  所以模型知道你在问什么，而不用猜「这里」指哪里。
                </Concept>
              </Card>

              <Card>
                <Concept
                  icon={<IconMap width={15} height={15} />}
                  name="Map · 地图"
                >
                  所有主题构成一张<strong>可以导航的地图</strong>。
                  <br />
                  你不仅记得「我讨论过这个」，
                  还记得<strong>「它在思考空间的哪个位置」</strong>。
                </Concept>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-1.5 text-[19px] leading-snug font-semibold">
                  它和传统聊天最大的不同：结构本身会变成 AI 的上下文
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  这是 ThinkingSpace 最核心的一点。
                </p>
              </div>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  传统做法
                </div>
                <div className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  全部历史 → 全部发送给模型
                </div>
                <div className="mt-2">
                  <Bad>Token 越来越贵</Bad>
                  <Bad>无关内容稀释注意力</Bad>
                  <Bad>模型分不清哪句在问什么</Bad>
                </div>
              </Card>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  ThinkingSpace 的做法
                </div>
                <div
                  className="mb-2 rounded-lg px-3 py-2 font-mono text-[11.5px]"
                  style={{ background: 'var(--bg)', color: 'var(--muted)' }}
                >
                  项目概述
                  <br />↓ 上层主题摘要（沿树向上）
                  <br />↓ 当前主题的对话
                  <br />↓ 分支锚点（你从哪句话分出来的）
                  <br />↓ 你现在的问题
                </div>
                <Good>只发与当前主题真正相关的内容</Good>
                <Good>沿树结构取上下文，不读无关分支</Good>
                <Good>锚点让模型精确知道你在问哪一句</Good>
                <Good>
                  每条回答下方有<strong>「上下文透镜」</strong>，可以亲眼看到 AI 这次用了哪些内容
                </Good>
              </Card>

              <div
                className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  color: 'var(--text)',
                }}
              >
                <strong>你看到的结构，就是 AI 看到的记忆结构。</strong>
                <br />
                信息架构、你的认知结构、模型的上下文结构——第一次是同一件事。
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-1.5 text-[19px] leading-snug font-semibold">
                  不只是发散，还能收敛
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  大多数 AI 工具只擅长「继续往下」。真正的思考需要两步：
                  <strong style={{ color: 'var(--text)' }}>先发散，再收敛。</strong>
                </p>
              </div>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  发散
                </div>
                <Good>选中一句话即可开分支，并选择思考方式：深入解释 / 为什么 / 举例 / <strong>反例</strong> / 建立联系</Good>
                <Good>AI 还会主动提议 2–4 个值得继续的方向——但只有你点击才会创建</Good>
                <Good>每个主题都能折叠或隐藏，地图不会被撑爆</Good>
              </Card>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  收敛
                </div>
                <Good>
                  <strong>当前理解</strong>：每个主题由 AI 总结出的结论性概述；
                  更新时先看 <strong>+/− 差异</strong>，你确认后才生效
                </Good>
                <Good>
                  <strong>综合理解</strong>：把多个子分支的探索，收敛成父主题更高层的理解
                </Good>
                <Good>
                  <strong>综合节点</strong>：多选几个主题，收敛成一段统一认识，并记下尚未解决的矛盾
                </Good>
                <Good>
                  <strong>知识地图</strong>：由全部卡片的「当前理解」生成整个项目的知识点思维导图，可导出 PDF
                </Good>
                <Good>
                  <strong>待解决问题</strong>：把还没搞懂的问题记下来，全项目共享一份清单
                </Good>
              </Card>

              <Card>
                <div className="mb-2 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  随时找回来
                </div>
                <Good>最近浏览 · 收藏 · 全局搜索（Ctrl+K）</Good>
                <Good>每个主题有独立链接，可复制、可收藏</Good>
                <Good>选中深层主题时，祖先链会被高亮，一眼看清来路</Good>
                <Good>
                  <strong>思考回放</strong>：拖动时间轴，回看这棵树是怎么一步步长出来的
                </Good>
              </Card>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-1.5 text-[19px] leading-snug font-semibold">
                  什么时候适合用它
                </h2>
              </div>

              <Card>
                <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
                  <span style={{ color: '#16a34a' }}>
                    <IconCheck width={13} height={13} />
                  </span>
                  <span style={{ color: 'var(--text)' }}>特别适合：问题会产生问题</span>
                </div>
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  复杂学习 · 论文阅读 · 技术研究 · 产品设计 · 软件架构 ·
                  Debug · 战略分析 · 知识探索 · 长期 AI 协作
                </div>
              </Card>

              <Card>
                <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
                  <span style={{ color: 'var(--faint)' }}>
                    <IconX width={13} height={13} />
                  </span>
                  <span style={{ color: 'var(--text)' }}>不一定适合：用普通聊天更快</span>
                </div>
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  「今天天气怎么样」
                  <br />
                  「帮我把这句话改礼貌一点」
                </div>
              </Card>

              <div
                className="rounded-xl px-4 py-3.5 text-[12.5px] leading-relaxed"
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  color: 'var(--text)',
                }}
              >
                <div className="mb-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                  现在就可以开始
                </div>
                <strong>不用注册也能完整体验</strong>——内容只保存在这台设备的浏览器里，别人看不到。
                <br />
                想跨设备同步（换电脑、用手机也能看到），随时注册即可，本机内容会自动上传。
                <br />
                <br />
                AI 能力需要你自己的 API Key。没配置时可以用「离线演示」模式先体验界面，
                想拿到真实回答时，再点「如何获取 API Key」按步骤配置（大约 5 分钟）。
              </div>

              <div
                className="rounded-xl px-4 py-3.5 text-[12.5px] leading-relaxed"
                style={{
                  background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
                  border: '1px solid color-mix(in srgb, #f59e0b 38%, transparent)',
                  color: 'var(--text)',
                }}
              >
                <div
                  className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: '#b45309' }}
                >
                  <IconInfo width={14} height={14} />
                  提醒
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span style={{ color: '#b45309' }}>·</span>
                    <span>
                      <strong>尽量用平板或笔记本电脑</strong>。手机上所有功能都能正常使用，
                      但地图浏览、拖拽分支这些操作，在大屏上会顺手得多。
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span style={{ color: '#b45309' }}>·</span>
                    <span>
                      如果你<strong>长期只在这一台设备上使用</strong>，其实更推荐直接用「导出」功能
                      把项目存成本地 JSON 文件。
                      我们的云端同步还在早期阶段，功能不算强大；
                      对单设备使用来说，本地文件反而更简单也更稳妥。
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部导航 */}
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 md:px-5 md:py-3.5"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            className="btn btn-ghost !text-[12.5px] md:!text-sm"
            disabled={step === 0}
            style={{ opacity: step === 0 ? 0.35 : 1 }}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <IconChevronLeft width={15} height={15} />
            上一步
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {step < TOTAL - 1 ? (
              <button
                className="btn btn-primary !text-[12.5px] md:!text-sm"
                onClick={() => setStep((s) => s + 1)}
              >
                下一步
              </button>
            ) : (
              <>
                <button
                  className="btn btn-ghost !text-[12.5px] md:!text-sm"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => {
                    finish();
                    setApiKeyGuideOpen(true);
                  }}
                >
                  <IconKey width={14} height={14} />
                  如何获取 API Key
                </button>
                <button
                  className="btn btn-outline !text-[12.5px] md:!text-sm"
                  onClick={finish}
                >
                  直接开始体验
                </button>
                {cloudStatus !== 'disabled' && (
                  <button
                    className="btn btn-primary !text-[12.5px] md:!text-sm"
                    onClick={startWithGitHub}
                  >
                    <IconGitHub width={15} height={15} />
                    用 GitHub 登录
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
