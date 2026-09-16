// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

import type { ReactNode } from 'react';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { IconGitHub, IconInfo, IconKey, IconSpark } from './icons';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3
        className="mb-2.5 pb-1.5 text-[13px] font-semibold"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-[12.5px] leading-relaxed">
      <span className="w-[104px] shrink-0 font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </span>
      <span className="flex-1" style={{ color: 'var(--muted)' }}>
        {children}
      </span>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
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

export function HelpPanel() {
  const open = useStore((s) => s.helpOpen);
  const setOpen = useStore((s) => s.setHelpOpen);
  const setOnboardingOpen = useStore((s) => s.setOnboardingOpen);
  const setApiKeyGuideOpen = useStore((s) => s.setApiKeyGuideOpen);
  const setFeedbackOpen = useStore((s) => s.setFeedbackOpen);

  return (
    <Modal open={open} title="使用说明" onClose={() => setOpen(false)} width={720}>
      <p className="mb-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        ThinkingSpace 把 AI 对话从一条时间线，变成一个可以探索的思维空间。
        每个「主题」是一张卡片，卡片内部可以有多轮对话，卡片之间用分支连接。
        <br />
        它保存的不是「我和 AI 说过什么」，而是「我是怎样想到这里的」。
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          className="btn btn-outline"
          onClick={() => {
            setOpen(false);
            setOnboardingOpen(true);
          }}
        >
          <IconSpark width={14} height={14} />
          重新观看新手指引
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            setOpen(false);
            setApiKeyGuideOpen(true);
          }}
        >
          <IconKey width={14} height={14} />
          如何获取 API Key
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            setOpen(false);
            setFeedbackOpen(true);
          }}
        >
          <IconInfo width={14} height={14} />
          反馈问题
        </button>
        <a
          className="btn btn-outline"
          href="https://github.com/Tommy-hang/Thinkingspace"
          target="_blank"
          rel="noreferrer noopener"
          title="在 GitHub 上查看全部源代码"
        >
          <IconGitHub width={14} height={14} />
          GitHub 仓库
        </a>
      </div>

      <Section title="地图（Map）">
        <Row label="平移 / 缩放">按住空白处拖动平移；滚轮缩放；右下角有缩放按钮。</Row>
        <Row label="移动卡片">直接拖动卡片，位置会自动保存。</Row>
        <Row label="打开主题">单击任意卡片，整屏展开进入聚焦视图。</Row>
        <Row label="整理布局">顶部「整理布局」把地图排成整齐的树形。折叠状态下只排列可见节点。</Row>
        <Row label="连线含义">
          细实线是<strong>父子结构</strong>（由分支自动产生），虚线是<strong>综合节点</strong>指向它的来源主题。
          连线由系统维护，<strong>不需要也不能手动连接</strong>——这样才能保证地图始终忠实反映你的思考结构。
        </Row>
      </Section>

      <Section title="卡片右键菜单（重要）">
        <Row label="怎么打开">在地图上右键任意卡片；左侧主题树里也可以右键。</Row>
        <Row label="重命名卡片">手动固定标题。设置后系统不再自动改写它。</Row>
        <Row label="查看所有提问">列出这张卡片里的全部提问（第 1 轮、第 2 轮…），点任意一条直接跳转到对话中的那一处。</Row>
        <Row label="收藏">把重要主题钉在左侧「已收藏」区。</Row>
        <Row label="复制链接">得到一个只指向这个主题的网址。</Row>
        <Row label="导出为 Markdown">把这张卡片连同它下面所有子分支导出成一篇文章。</Row>
        <Row label="拆分到另一个项目">
          把这张卡片连同它下面所有子分支、对话<strong>移动</strong>到另一个项目，并从当前项目移除；
          点击后会出现项目选择界面。误操作可用 <Key>Ctrl + Z</Key> 撤销。
        </Row>
        <Row label="复制到另一个项目">
          把这张卡片连同它下面所有子分支、对话<strong>复制</strong>到另一个项目，当前项目保持不变。
        </Row>
        <Row label="创建子分支">直接在当前卡片下新建一个子主题，并进入它开始对话。</Row>
        <Row label="折叠子分支">本卡片保留，暂时收起它下面的所有后代。</Row>
        <Row label="隐藏 / 显示子分支">
          把直接子分支整体隐藏；隐藏后这一项会变成「显示子分支」，再点一下就恢复。
        </Row>
        <Row label="隐藏自身">这张卡片和它的所有子分支都从地图上消失（数据不会删除）。</Row>
        <Row label="删除子分支">删掉这张卡片下面的所有子分支（含各自后代），卡片本身保留。</Row>
        <Row label="删除主题">永久删除这张卡片及其所有子分支，无法恢复。</Row>
      </Section>

      <Section title="聚焦视图（Focus）">
        <Row label="进入 / 返回">点卡片进入；左上角「返回地图」退出，地图的缩放与位置会保留。</Row>
        <Row label="提问">底部输入框，<Key>Enter</Key> 发送，<Key>Shift + Enter</Key> 换行。</Row>
        <Row label="创建分支">选中回答里的任意文字 → 浮出「解释 / 追问 / 分支」→ 点「分支」选择思考方式。</Row>
        <Row label="思考方式">深入解释 / 为什么 / 举例 / 反例 / 建立联系 / 自定义问题。其中「反例」会主动追问这个说法在什么条件下不成立。</Row>
        <Row label="修改标题">点顶部大标题即可直接编辑。</Row>
        <Row label="编辑提问">鼠标移到最近一次提问上 → 点「编辑」，改完会重新生成回答。</Row>
        <Row label="重新生成">鼠标移到最近一条回答上 → 点「重新生成」。</Row>
        <Row label="状态">右上角可设为 进行中 / 探索中 / 已收敛 / 暂搁置。</Row>
      </Section>

      <Section title="理解与收敛">
        <Row label="当前理解">
          主题顶部的「当前理解」块，是 AI 根据这段对话总结出的结论性概述。它同时会被搜索、悬停预览和 @ 引用使用。
        </Row>
        <Row label="更新理解">
          点「更新理解」，让 AI 根据整段对话重新生成。如果已有旧版本，会先显示
          <strong>句子级 +/− 差异</strong>，你点「采纳为新版本」后才生效——不会直接覆盖。
        </Row>
        <Row label="历史版本">
          每次采纳都会把旧版本存进「历史版本」（保留最近 10 个），可随时展开回看你的理解是怎么演变的。
        </Row>
        <Row label="综合节点">
          顶部「综合」按钮：选中 2 个以上主题，AI 把它们的「当前理解」收敛成一段统一认识，
          并单独记下<strong>尚未解决的矛盾</strong>。结果成为一张新卡片，用引用线连回来源主题；
          来源更新后会提示「可能已过期」，可一键重新综合。
        </Row>
        <Row label="综合理解">
          当一个主题有 2 个以上子分支时，顶部会出现「综合理解」按钮：AI 把各子分支的结论收敛成一段更高层的理解，不会删除或改动任何分支。
        </Row>
        <Row label="待解决问题">
          属于<strong>整个项目</strong>，所以每张卡片里看到的都是同一份清单，左侧栏也是同一份。
          每条问题会记住它来自哪张卡片，<strong>点击问题即可跳回创建它的地方</strong>。解决后打勾即可。
        </Row>
        <Row label="记为问题">
          鼠标悬停任意一条消息，点「记为问题」，它会变成一条待解决问题供你修改。
        </Row>
      </Section>

      <Section title="上下文透镜（它为什么懂你）">
        <Row label="是什么">
          每条 AI 回答下方都有一个可展开的「上下文透镜」，列出这次回答<strong>实际使用了哪些内容</strong>：
          项目目标、上游主题、分支锚点、联网结果、@ 引用的主题、本主题对话、当前问题。
        </Row>
        <Row label="为什么重要">
          ThinkingSpace 不会把全部历史发给模型，而是沿主题树只取相关内容。
          透镜让你<strong>亲眼看到</strong>这一点，也方便判断回答跑题时问题出在哪。
        </Row>
        <Row label="其他主题">
          透镜里会标明「其他 N 个无关主题未加入」——这就是它和普通聊天最大的不同。
        </Row>
      </Section>

      <Section title="思考回放（复盘）">
        <Row label="是什么">
          顶部「回放」按钮：把整个项目的历史整理成一条时间线——最初的问题、第一个分支、
          哪次更新了「当前理解」、最后形成了什么结论。
        </Row>
        <Row label="怎么用">
          拖动时间轴或点「播放」可以一段段回看；点任意事件即可跳转到对应主题。
          末尾还会列出「最终形成的理解」和「被搁置的分支」。
        </Row>
        <Row label="适合">学习复盘、研究记录、给同学讲「我是怎么搞懂这个的」。</Row>
      </Section>

      <Section title="知识地图（整个项目）">
        <Row label="是什么">
          把整个项目里所有卡片的「当前理解」汇总起来，生成一张<strong>只包含知识点</strong>的思维导图。
          图上不会出现对话内容。
        </Row>
        <Row label="怎么打开">顶部栏的「知识地图」按钮。</Row>
        <Row label="生成过程">
          分两步：先把每张「有对话」的卡片各更新一次「当前理解」，再根据这些理解之间的知识点关系构建导图。
          它<strong>不读取全部对话</strong>，所以成本可控；卡片越多，第一步耗时越长。
        </Row>
        <Row label="来源卡片">
          每个知识点下面会列出它来自哪几张卡片。点卡片名 → 关闭地图并定位到那张卡片。
        </Row>
        <Row label="重新生成">卡片有新增后，点右上角「重新生成」即可刷新整张图。</Row>
        <Row label="导出 PDF">
          点右上角「导出 PDF」，浏览器会打开打印窗口。在「目标打印机 / 目的地」里选择
          <strong>「另存为 PDF」</strong>，再点保存即可。
          导出的是<strong>矢量图</strong>，放大不会模糊；建议纸张方向选「横向」。
        </Row>
      </Section>

      <Section title="探索方向与主题引用">
        <Row label="探索方向">
          每次回答后，AI 会提议 2-4 个值得继续的方向。**只有你点击其中一个，才会真正创建分支**——地图始终由你控制。
        </Row>
        <Row label="换一批 / 忽略">可以重新生成建议，也可以直接忽略。不想用可在 设置 → 思考辅助 中关闭。</Row>
        <Row label="@ 引用">
          在输入框输入 <Key>@</Key>，会列出本项目里的主题；选中后 AI 会读取那个主题的「当前理解」，
          从而把你过去的思考纳入本次回答，而不需要重复解释。
        </Row>
      </Section>

      <Section title="导航：怎么快速找回来">
        <Row label="最近">左侧「最近」记录你最近走过的 6 个主题，一键跳回。</Row>
        <Row label="已收藏">左侧「已收藏」常驻你标记为重要的主题。</Row>
        <Row label="搜索">顶部「搜索」或 <Key>Ctrl + K</Key>，可搜标题、摘要和全部对话内容。</Row>
        <Row label="主题结构">左侧树形图展示完整层级，点击即在地图上定位。</Row>
        <Row label="主题直链">每个主题有独立网址，可复制收藏。打开链接会自动切换到对应项目和主题。</Row>
        <Row label="思考路径高亮">选中一个深层主题时，它的祖先链会被强调，一眼看清来路。</Row>
      </Section>

      <Section title="显示控制：折叠与隐藏">
        <Row label="折叠">卡片上仍可见，只是后代被收起。卡片上会显示「隐藏 N」。</Row>
        <Row label="隐藏">卡片本身也消失。隐藏后它的子分支默认一起隐藏。</Row>
        <Row label="怎么恢复">在左侧主题树里，被隐藏的节点会变灰显示，右键它 → 「取消隐藏自身」；或点树顶部的「显示全部」。</Row>
        <Row label="不影响数据">折叠和隐藏都只是显示状态，不会删除或改变任何内容。</Row>
      </Section>

      <Section title="云端同步与账号">
        <Row label="同步">登录后，项目会自动同步到云端；换设备登录同一账号即可看到同一份内容。</Row>
        <Row label="用量">
          账号面板里可以看到「已用项目数」和「内容体积」。免费额度：最多 20 个项目、总量 20MB、
          单个项目 4MB。
        </Row>
        <Row label="同步冲突">
          如果两台设备改了同一份内容，系统<strong>不会覆盖任何一边</strong>：会把另一份另存为一个新项目
          （名字带「冲突副本」），并在顶部给出提示。你可以打开两份，整理后删掉不需要的那份。
        </Row>
        <Row label="删除账号">
          账号面板 → 删除我的账号。会永久删除云端保存的全部数据；可选择是否同时清除本机数据。
        </Row>
      </Section>

      <Section title="AI 设置">
        <Row label="模型">对话输入框上方可随时切换模型（DeepSeek-V4.1-Flash / V4-Pro 等）。</Row>
        <Row label="深度思考">同一排的「深度思考」开关，可控制是否让模型先推理再回答，并可调思考强度。</Row>
        <Row label="联网搜索">打开后，提问会先检索网页，再把资料交给模型，回答下方会列出「参考来源」。</Row>
        <Row label="API Key">在 设置 里填写，只保存在你自己的浏览器中，不会被导出。</Row>
      </Section>

      <Section title="数据与备份">
        <Row label="自动保存">所有内容自动保存在当前浏览器里，无需手动保存。</Row>
        <Row label="导出">顶部下载图标 → 导出当前项目 / 全部项目，得到一个 .json 文件。</Row>
        <Row label="导入">同一个菜单 → 导入 .json，会作为新项目加入，不会覆盖现有内容。</Row>
        <Row label="重要提醒">浏览器数据可能因为清理缓存、换浏览器或换电脑而丢失。重要内容请定期导出备份。</Row>
        <Row label="隐私">
          不登录时内容只存在本机；登录后同步到云端，且<strong>只有你自己能看到</strong>。
          API Key 始终只保存在你的浏览器里。详见 设置 → 隐私与数据。
        </Row>
      </Section>

      <Section title="快捷键">
        <Row label="撤销">
          <Key>Ctrl + Z</Key>（在输入框内则是文字撤销）
        </Row>
        <Row label="重做">
          <Key>Ctrl + Shift + Z</Key> 或 <Key>Ctrl + Y</Key>
        </Row>
        <Row label="搜索">
          <Key>Ctrl + K</Key>
        </Row>
        <Row label="发送 / 换行">
          <Key>Enter</Key> / <Key>Shift + Enter</Key>
        </Row>
        <Row label="关闭弹层">
          <Key>Esc</Key>
        </Row>
      </Section>

      <Section title="开源">
        <Row label="源代码">
          全部代码公开在 GitHub 上，可以自行审查，或请懂技术的朋友帮你看：
          <a
            href="https://github.com/Tommy-hang/Thinkingspace"
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: 'var(--accent)', wordBreak: 'break-all' }}
          >
            https://github.com/Tommy-hang/Thinkingspace
          </a>
        </Row>
        <Row label="许可协议">
          采用 <strong>AGPL-3.0</strong> 开源协议：可以自由使用与修改，
          但衍生作品也必须开源——不允许被改成闭源产品。
          「ThinkingSpace」名称与宣传海报属于作者品牌资产，不在代码许可范围内。
        </Row>
        <Row label="遇到问题">
          欢迎在仓库的 Issues 里反馈，也可以直接用上面的「反馈问题」（会自动带上诊断信息）。
        </Row>
      </Section>

      <div
        className="rounded-xl p-3 text-[12px] leading-relaxed"
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--muted)',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
        }}
      >
        提示：新主题的标题会在第一次对话结束后，由 AI 根据对话的<strong>核心知识点</strong>自动生成，
        而不是直接使用你的问题。如果你手动重命名过，系统就不会再改写它。
      </div>
    </Modal>
  );
}
