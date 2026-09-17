# ThinkingSpace 交接文档

> 给下一个 AI Agent：读完这份文件，你应该能立刻接手这个项目。
> 最后更新：2026-09-16 · 当前版本 **V0.6.14**

---

## 0. 先读这三份

| 文件 | 作用 |
| --- | --- |
| `AGENTS.md` | 项目规则、命令、目录结构（**必须先读**） |
| `HANDOFF.md`（本文件） | 项目全貌、已完成/待办、坑与约定 |
| `README.md` | 面向公开用户的介绍（改功能后记得同步） |

另外两份产品原始文档也值得浏览一遍：
`ThinkingSpace_Highlights.md`（产品理念，最重要）、`ThinkingSpace_DeveloperGuide.md`（零基础开发手册）。

---

## 1. 这个项目是什么

**一句话**：把 AI 对话从一条时间线，变成一个可以探索的思维空间。

**核心创新（最重要，别丢掉）**：

1. **Card 不是 Message** —— 一个认知主题 = 一张卡片，内部可以有很多轮对话。
   200 条消息 ≠ 200 个节点，否则地图会失去意义。
2. **Branch 携带锚点** —— 从 AI 回答里选中任意一句话就能开分支，
   并记录「来自哪个节点的哪条消息的哪句话」。
3. **⭐ UI 结构 = AI 的上下文结构** —— 这是与所有"AI 聊天 + 可视化"产品的根本区别：
   ```
   传统：全部历史 → 全部发给模型
   我们：项目概述 → 上层主题摘要 → 当前主题对话 → 分支锚点 → 当前问题
   ```
   用户看到的主题树，本身就是模型的上下文检索结构。
4. **不只是发散，还能收敛** —— 当前理解 / 综合理解 / 知识地图 / 待解决问题。
5. **AI 提议，用户决定** —— AI 绝不自动创建节点、自动连线、自动重构地图。

**目标用户**：正在系统性啃一大块新知识的学生（一门新课、一篇论文、一个新方向）。

---

## 2. 项目所有者怎么工作（很重要）

- **他是非程序员**，不做任何代码工作。
- 需要：**修改前先解释要做什么 → 直接改代码 → 改完跑测试 → 出错自己修**。
- 需要人工操作时，必须给「点击哪里 → 输入什么 → 应该看到什么」的逐步说明。
- 他喜欢**详细的解释**（愿意读长内容），中文交流。
- 他会提出产品判断，而且**经常是对的**（例如他否决了"手动建立引用关系"这个功能，
  理由是"没人会去手动建链接"——判断准确）。
- 他会在意：视觉克制、低噪声、不破坏空间感。
- **不要让他自己写代码**，也不要只给方案不动手。

---

## 3. 技术栈与架构

```
React 19 + TypeScript + Vite + Tailwind CSS v4 + @xyflow/react + zustand + Supabase
```

无后端服务器（Supabase 直连），纯前端。

### 关键架构决策（不要破坏）

| 决策 | 为什么 |
| --- | --- |
| **同步只存在于一层** | 全部在 `src/lib/cloud/`，业务代码完全不知道"云端"的存在。改功能时不需要考虑同步 |
| **每个项目内容整体存一个 JSON**（`content jsonb`） | 加字段**不用改数据库**，是数据演进最省心的方案 |
| **迁移只有一个入口** | `migrateOpenQuestions()`（`src/lib/storage.ts`），**本地读取与云端拉取两条路径都会调用** |
| **项目级同步标记持久化在本地** | `Project.cloudRevision` / `cloudUpdatedAt`，用于判断"云端变没变"和"本地有没有未上传的改动" |
| **元信息优先拉取** | 同步时先只拉项目列表，只有云端确实变过的项目才拉 `content`（省约 90% 流量） |
| **本地优先** | 改动永远先写本地，云端异步补写，失败自动重试。断网也能用 |

### 数据流

```
用户操作 → store.set() → 统一 subscribe → saveData(localStorage)
                                      └→ schedulePush(900ms 防抖) → 云端
```

---

## 4. 部署与基础设施

| 项目 | 值 |
| --- | --- |
| 线上地址 | https://tommy-hang.github.io/Thinkingspace/ |
| 仓库 | https://github.com/Tommy-hang/Thinkingspace （**公开**） |
| Supabase 项目 ref | `ijaerpotyyyfjcmjaxic` |
| Supabase URL | `https://ijaerpotyyyfjcmjaxic.supabase.co` |
| 前端用的 key | `sb_publishable_...`（新版命名，等价旧 anon key，**公开无害**） |

### 分支策略

```text
main      → 线上（推送到 main 触发 GitHub Pages 自动部署）
vX.Y.Z    → 开发分支，验收后 ff-merge 到 main
```

### 推送需要代理

`github.com` 的 DNS 被污染，但 `github.io` / `api.github.com` / `raw.githubusercontent.com` 可直连。

```bash
git config http.proxy http://127.0.0.1:7897   # 已在本仓库配置好
```

### 配置存放位置

| 配置 | 本地 | 线上 |
| --- | --- | --- |
| Supabase URL / key | `.env.local`（已 gitignore） | GitHub **Actions Variables**（不是 Secrets） |
| 数据库连接串（备份用） | — | GitHub **Secret** `SUPABASE_DB_URL` |

### 三个 GitHub Actions

| 工作流 | 时间 | 作用 |
| --- | --- | --- |
| `deploy.yml` | push 到 main | 构建并发布到 GitHub Pages |
| `keep-alive.yml` | 每天 02:10 UTC | 访问一次数据库，防止免费项目 7 天不活动被暂停 |
| `backup.yml` | 每天 18:40 UTC | `pg_dump` 整个数据库，存为 artifact 保留 90 天 |

---

## 5. 已完成的功能（V0.1 → V0.6.0）

### V0.1 交互原型 ✅
Map / Topic Card / Focus View / Branch / 本地保存

### V0.2 AI 原型 ✅
Provider 层（OpenAI 兼容 + 离线 mock）/ 流式输出 / Context Engine / Branch Context

### V0.3 个人日常使用 ✅
- 项目管理 / 搜索 / 节点状态 / 自动布局 / 导入导出 / 设置
- **V0.3.1** Markdown + KaTeX 渲染、V4 模型与思考模式、联网搜索
- **V0.3.2** GitHub Pages 自动部署
- **V0.3.3** 撤销重做 / 子树折叠 / 思考路径高亮 / 最近 / 收藏 / 主题直链 /
  分支意图（深入解释·为什么·举例·**反例**·建立联系·自定义）/ Markdown 导出 /
  编辑重生成 / 悬停预览
- **V0.3.4** 使用说明面板 / AI 按核心知识点自动生成标题 / 卡片与侧栏右键菜单 / 隐藏机制
- **V0.3.5** 当前理解 / 待解决问题（项目级共享）/ AI 探索方向建议 / 综合理解 / @ 引用主题
- **V0.3.6** 知识地图（知识点思维导图 + 导出 PDF）

### V0.4 云端 ✅
- Supabase Auth（GitHub 一键登录 + 邮箱注册）/ 跨设备云同步 / RLS 行级隔离
- **V0.4.1** 按需加载 + 定时保活
- **V0.4.2** GitHub 账号一键登录
- **V0.4.3** 隐私说明 / 新手指引

### V0.5 移动端 ✅
抽屉侧栏 / 工具栏收纳 / 触屏常显按钮 / 防 iOS 聚焦缩放 / 刘海屏适配
- **V0.5.1** 「如何获取 API Key」分步教程

### V0.6.0 公开测试加固 ✅
- 每日自动备份（已实测：dump 约 198KB）
- 应用内反馈入口（带诊断信息 + 最近 8 条错误，可复制或开 GitHub Issue）
- 容量保护（已实测生效）：单项目 ≤4MB / 每账号 ≤20 项目 / 每账号总量 ≤20MB
- 手机侧栏长按菜单修复（原来手机上无法打开侧栏菜单）

### V0.6.1 跨项目整理 ✅
- 卡片右键菜单新增「拆分到另一个项目」与「复制到另一个项目」，点击后弹出项目选择界面
- 拆分 = 把自己和全部子分支（含对话、相关待解决问题）移动到目标项目，并从当前项目移除
- 复制 = 生成全新 id 的完整副本放进目标项目，原项目完全不变
- 子树根在新项目里成为顶层主题；跨出边界的连线会被删除，子树内部连线随迁
- 移动支持 Ctrl+Z 撤销；纯逻辑在 `src/lib/projectTransfer.ts`（有 18 项冒烟测试覆盖）

### V0.6.2 信任收尾 ✅
- **同步冲突保底**：两台设备改过同一份内容时，不再静默覆盖——把落败的一方另存为新项目
  （`「标题」· 冲突副本 MM-DD HH:mm`），顶部弹出醒目横幅，账号面板里可打开副本
  - 完整同步：保留云端版本，本机改动另存副本
  - 增量推送：保留本机版本，另一台设备的改动另存副本
  - 逻辑在 `engine.ts`（`SyncConflictInfo`）+ `projectTransfer.ts`（`cloneProject`）
- **自助删除账号**：`supabase/schema.sql` 新增 `delete_my_account()` 函数
  （`security definer` + 只允许删 `auth.uid()`）；账号面板里可注销，可选是否同时清本机
- **用量提示**：账号面板显示已用项目数 / 内容体积 / 最大项目，接近上限变红（`src/lib/usage.ts`）

### V0.6.3 思考增强 ✅（用户从头脑风暴中挑选的四个方向）
- **上下文透镜**：`contextBuilder.ts` 现在返回 `{ messages, manifest }`，把「本次用了哪些内容」
  （项目目标 / 上游主题 / 分支锚点 / 联网结果 / @ 引用 / 本主题对话 / 当前问题 / 未加入主题数）
  挂到 `Message.contextManifest`，每条 AI 回答旁可展开查看（`ContextLens.tsx`）
  - 意义：把「UI 结构 = AI 上下文结构」这个核心卖点变成用户看得见的东西
- **综合节点**：多选主题 → `generateSynthesis` 收敛出「统一观点 + 未解决矛盾」，
  生成一张新卡片（`TopicNode.synthesis`）并用 `reference` 边连回来源；来源更新后提示「可能已过期」并可重新综合
  - 入口：顶部「综合」按钮 / 手机「更多」→ `SynthesisPanel.tsx`
- **思考回放**：`lib/replay.ts` 只用已有时间戳推导事件流（起点 / 主题 / 分支+锚点 / 理解更新 / 综合），
  全屏视图带时间轴拖动与播放，末尾展示「最终形成的理解」与「被搁置的分支」（`ThoughtReplayView.tsx`）
- **当前理解版本差异**：更新「当前理解」不再直接覆盖——`lib/diff.ts` 做句子级 LCS 差异，
  展示 +/− 后由用户「采纳 / 放弃」；采纳时旧版进 `TopicNode.summaryVersions`（保留 10 个），可回看历史
  - 知识地图的批量更新走 `refreshSummary(id, { autoApply: true })`，不弹差异
- **V0.6.4**：把 V0.6.3 的四项写进「使用说明」与「新手教学」（新手教学只做简要提及）
- **V0.6.5**：顶栏窄屏优化 + 公式渲染修复
  - 顶栏：文字标签改为仅在 `xl`（短标签）/ `2xl`（长标签）显示，窄屏一律图标 + 悬停提示；
    次要操作在 `md`~`lg` 收进「更多」菜单；所有按钮 `shrink-0`、标签 `whitespace-nowrap`，
    彻底消除「文字被挤成竖排/换行」
  - 提示：新增纯 CSS 的 `.ts-tip`（`data-tip` 属性 + `::after`），悬停显示名称与功能解释；触屏不显示
  - 公式：新增 `src/lib/markdown.ts` 的 `normalizeMathDelimiters()`，把模型输出的
    `\[ ... \]` / `\( ... \)` 转成 `$$...$$` / `$...$`（Markdown 会把 `\[` `\(` 当转义吃掉反斜杠，
    这正是公式退化成 `[ h_t = ... ]`、`(h_t)` 的原因）；`Markdown.tsx` 渲染前调用；SYSTEM_PROMPT 增加第 6 条
- **V0.6.6**：宣传海报进产品
  - 原图在 `宣传海报/`（1672×941 与 941×1672，各约 2MB PNG）
  - 压缩后放进 `src/assets/poster-landscape.jpg` / `poster-portrait.jpg`（各约 190KB，质量 85）
  - 新手教学新增**第 0 步封面页**（`TOTAL` 5→6，横屏桌面 / 竖屏手机自适应）；README 顶部也放了横屏海报
- **V0.6.7**：使用说明（`HelpPanel`）加入 GitHub 仓库链接（顶部快捷按钮 + 底部「开源」一节）
- **V0.6.8**：授权与知识产权
  - 根目录 `LICENSE` = AGPL-3.0 官方原文（从 gnu.org 下载，661 行，**逐字未改**）
  - `package.json` 加 `"license": "AGPL-3.0-only"`；README 顶部加协议徽章 + 末尾「许可」一节
  - 明确声明：「ThinkingSpace」名称、Logo、宣传海报属**作者品牌资产，不在代码许可范围内**
  - 应用内：隐私说明「开源透明」与使用说明「开源」两处都写明协议
  - 版权署名：`Copyright (C) 2026 张文曜 (Tommy-hang)`
- **V0.6.9**：补全知识产权与社区规范文件（**改动功能时一般不需要动这些**）
  - `CLA.md` —— 贡献者许可协议：贡献者保留著作权，但授予作者**重新授权（含商业授权）**的权利
  - `CONTRIBUTING.md` —— 贡献流程、代码约定、必须跑的三项测试
  - `TRADEMARK.md` —— 品牌政策：AGPL 授权代码，**不授权品牌**（名称/Logo/海报）
  - `NOTICE` —— 版权声明 + AGPL 标准声明 + 资产排除 + 第三方说明
  - `SECURITY.md` —— 安全问题私密报告渠道 + 本项目安全边界
  - `CODE_OF_CONDUCT.md` —— Contributor Covenant 2.1（已填联系方式）
  - `.github/ISSUE_TEMPLATE/{config,bug_report,feature_request}.yml` + `PULL_REQUEST_TEMPLATE.md`（PR 模板含 CLA 勾选）
  - `CITATION.cff` —— 学术引用信息
- **V0.6.10**：版权信息补全（**AGPL 正文没有可填写的占位符，与 MIT 不同**，所以版权信息要单独附加）
  - `LICENSE` **末尾**加「版权声明」区（项目名 / 版权 / SPDX / 品牌排除），**正文逐字未动**
    - ⚠️ 坑：版权信息放在**开头**会让 GitHub 识别不出协议（变成 `NOASSERTION`）；
      放**末尾**才能既保留信息又让 GitHub 正确识别为 AGPL-3.0
  - **全部 65 个源文件**开头加 SPDX 头：`// SPDX-License-Identifier: AGPL-3.0-only` + 版权行
  - `package.json` 补全 `description` / `author` / `homepage` / `repository` / `bugs`
  - README「许可」一节说明这一点
- **V0.6.11**：禁止手动随意连线（用户反馈「节点线条可以随意连接，会扰乱对话顺序和思路」）
  - 移除 `MapView` 的 `onConnect`；`nodesConnectable={false}`；卡片手柄 `isConnectable={false}` 且不再随 hover 显现
  - 新增 `tree.ts` 的 `getMeaningfulEdges()`：地图**只画**「父子结构线」+「综合节点引用线」，
    历史遗留的手动杂线**不再显示**（数据仍在，未删除）
  - 综合引用线改为**虚线**，与结构线区分
  - 删除 store 里已无用的 `addEdge` 动作
  - 使用说明「连接卡片」一条改为「连线含义」
- **V0.6.12**：新手教学优化（用户要求「让用户感受到产品优势的具体场景」）
  - 新增**第 2 页「它写给谁用」**（`TOTAL` 6→7）：目标用户 → 越问越乱的具体场景 →
    「你不缺 AI 的回答」→ 4 条「处境 → 怎么解决」对照卡（桌面两列 / 手机一列）
  - **整体放大**：弹窗 `maxWidth` 720→940、`max-h` 88vh→92vh；正文/卡片字号整体上调一档
    （19→23px 标题、12.5→14.5px 正文、13→15.5px 导语）；卡片内边距 `p-3.5`→`p-4`
  - 说明：字号是用临时 Node 脚本批量替换的（`text-[Npx]` 单次映射，避免连锁替换）
- **V0.6.13**：修复「生成文字被截断、语义不完整」（用户反馈）
  - 新增 `src/lib/text.ts` 的 `clipAtSentence(text, max)`：优先在**句末标点**收尾 →
    退到逗号/顿号 → 都没有才硬截（此时才补 `…`）
  - `title.ts` 的 `localSummary`：**90 字硬切 → 260 字 + 句子边界**（这是最主要的问题源，
    AI 返回异常或离线兜底时走的就是它）
  - `contextBuilder` 的上下文摘要、`replay` 的事件详情、`mention` 的「记为问题」、
    `search` 的检索摘要、`knowledgeMap` 的知识点标签：全部改为句子/标点边界收尾
  - 提示词明确要求「每句话都要说完整，不要出现半截话」：Topic 理解、综合理解、综合节点结论
  - 放宽输入上限：digest 6000→12000、insight 6000→12000、synthesis 8000→16000、
    knowledgeMap 14000→20000；`localSummary` 90→260、`firstSentence` 60→90
  - 冒烟测试 116→123 项（新增 7 项句子截断测试）
- **V0.6.14**：模型行为可控 + AI 用量透明（架构级升级）
  - **Behavior Profile**（`src/lib/behavior.ts`）：Profile = 5 个**行为维度**(0~4) + 自由说明；
    提示词由维度**声明式**生成，以后加维度只改 `BEHAVIOR_DIMENSIONS` 一处
    - 内置 7 个：default / explorer / engineer / scholar / critic / teacher / creator
    - **三级作用域**：`Settings.behavior.activeProfileId`（全局）→ `TopicNode.behaviorId`（会话）
      → `Message.behaviorId`（单条，UI 存 `messageBehaviorId`，发送后自动清空）
    - 预留 `BehaviorProfile.compute`（quick/balanced/deep），本版本只存不用
  - **统一 Usage**（`src/lib/ai/usage.ts`）：`Provider Adapter → RawUsage → normalizeUsage → AiUsage`
    - Provider 差异只允许出现在 `openaiCompatible.ts` 的 `parseUsage()`；
      `stream_options:{include_usage:true}`，遇 400/422 自动去掉重试（兼容自建端点）
    - 只有**调用成功**才记录 usage；失败 / 中断不产生虚假账单
  - **价格层**（`src/lib/pricing.ts`）：单价只在这里出现；`estimateCost` 区分
    `exact / estimated / free / unavailable`，未知模型**绝不返回 0**
  - **UI**：模型选择器内合入「行为倾向」选择；输入区有 Message Override 入口；
    每条回答下方 `UsageBadge`（默认一行，可展开明细）；会话顶部累计用量；
    回答动作里新增「换个视角」（`rethink`，会计为一次新调用）
  - 设置面板新增「行为倾向」「用量与费用」两节（自定义 Profile / 自定义模型价格 / 显示开关）
  - 冒烟测试 123→150 项要求

---

## 6. 核心文件地图

```text
src/
  types.ts                    所有数据模型
  version.ts                  APP_VERSION（每次改动 +1，用户在界面上核对版本）
  store/store.ts              ⭐ 全局状态 + 所有业务动作（约 1500 行，最核心）
  lib/
    ai/                       Provider 层 + Context Engine
      contextBuilder.ts       ⭐ 上下文构建（产品核心创新所在）
    cloud/                    ⭐ 云端同步（业务代码无感知）
      client.ts               连接（未配置时返回 null，应用退化为纯本地）
      auth.ts                 注册/登录/登出/会话/GitHub OAuth
      sync.ts                 两张表的读写 + revision 乐观锁
      engine.ts               ⭐ fullSync / pushDirty / 冲突处理
    search/                   联网搜索（Tavily / Exa / Serper）
    reasoning.ts              当前理解 / 探索方向 / 综合理解
    knowledgeMap.ts           知识地图生成
    knowledgeExport.ts        知识地图导出 SVG / PDF
    title.ts                  知识点标题与摘要提取（含离线兜底）
    tree.ts                   树遍历（祖先/后代/可见性）
    layout.ts                 自动布局（泛化为 {id,parentId}）
    exportImport.ts           导出 / 导入
    projectTransfer.ts        跨项目拆分 / 复制 / 整项目克隆（纯函数，可测试）
    usage.ts                  云端用量估算（与 schema.sql 的上限保持一致）
    diff.ts                   句子级差异（LCS），用于「当前理解」版本确认
    replay.ts                 思考回放事件流（纯函数，只用已有时间戳推导）
    markdown.ts               把模型输出的 \[..\] / \(..\) 归一成 $ / $$（修复公式不渲染）
    text.ts                   在句子边界截断（clipAtSentence），避免半截话
    behavior.ts               ⭐ Behavior Profile：维度定义 / 默认 Profile / 提示词生成 / 三级解析
    pricing.ts                ⭐ 模型价格层：单价表 + estimateCost（exact/estimated/free/unavailable）
    ai/usage.ts               ⭐ 用量归一化：RawUsage → AiUsage、格式化、会话累加
    storage.ts                ⭐ 本地持久化 + **数据迁移唯一入口**
    device.ts                 触屏/窄屏检测
    link.ts                   主题直链（hash 路由）+ 复制
    branchIntent.ts           分支意图定义与提问模板
  components/                 界面组件（约 20 个）
supabase/schema.sql           ⭐ 建表 + GRANT + RLS + 容量保护（**可重复运行**）
scripts/smoke.mjs             ⭐ 冒烟测试（48 项，无需浏览器）
scripts/cloud-check.mjs       云端联调（需 TS_TEST_EMAIL / TS_TEST_PASSWORD）
```

---

## 7. 常用命令

| 目的 | 命令 |
| --- | --- |
| 安装依赖 | `npm install` |
| 启动开发服务器 | `npm run dev`（http://localhost:5173） |
| 类型检查 | `npm run typecheck` |
| 生产构建 | `npm run build` |
| 冒烟测试 | `npm run smoke` |
| 云端联调 | `npm run cloud-check` |

**每次改完必须跑：`typecheck` + `build` + `smoke`，全绿才算完成。**

---

## 8. 踩过的坑（血泪教训）

### 数据库相关

1. **RLS 和 GRANT 缺一不可**
   RLS 管"能看哪些行"，GRANT 管"能不能碰这张表"。
   只写 RLS 不写 GRANT → `permission denied for table`。
   `supabase/schema.sql` 里两者都有，**只授权给 `authenticated`，不给 `anon`**（双保险）。

2. **数据库密码必须「纯字母数字」**
   连接字符串是 URL 格式，密码里的 `@ : / ? # [ ] { }` 会破坏解析。
   已踩两次：先是 `]`，后是 `@`。**不要用 Supabase 的 Generate 按钮**（会含符号）。

3. **免费版限制**：500MB 数据库 / 5GB 月流量 / **无自动备份** / **7 天不活动暂停**。

4. **GitHub 定时工作流在仓库 60 天无活动后会被自动禁用**。

### 开发相关

5. **PowerShell 5.1 的 `Invoke-RestMethod` 发中文会变问号**
   必须 `[System.Text.Encoding]::UTF8.GetBytes($body)` 后再发。

6. **`@($null).Count` 在 PowerShell 里等于 1**
   判断空数组要看 curl 返回的原始 body。

7. **`$pid` 是 PowerShell 保留变量**，别用来存项目 id。

8. **控制台中文输出会吃掉首位数字**
   冒烟测试的输出已改成 ASCII 标记（`APP_HTML_LEN=`）。

9. **`git checkout` 的提示走 stderr**，PowerShell 会显示成红色错误，**是正常的**。

10. **不要点旧运行记录的 "Re-run jobs"**
    重跑会用**当时的旧脚本**，新加的校验不会生效。要用 `Run workflow` 开新的。

### 产品相关

11. **手动的"关系维护"功能没人会用**
    （引用关系/反向链接）已因此被否决。

12. **hover 交互在触屏上无效**
    凡是 `opacity-0 group-hover:opacity-100` 的元素，都要加 `.ts-hover-only` 类。

---

## 9. 待办与下一步

### V0.6 已全部完成 ✅
- V0.6.0 每日备份 / 应用内反馈 / 容量保护 / 手机侧栏菜单
- V0.6.1 卡片跨项目拆分 / 复制
- V0.6.2 同步冲突保底 / 自助删除账号 / 用量提示

### V0.7+ 候选（产品增强，用户还没拍板）
- **Node Compare** —— 选两个主题横向比较，可保存为新主题
- **Reference Edge / Backlinks** —— 主题间非父子关系（⚠️ 手动建链接已被否决，
  若要做必须让 **AI 主动发现关联**）
- **Focus Queue** —— 接下来要研究的队列
- **Session** —— 研究时段回顾
- **Scratch Node** —— 轻量草稿

### 明确不做的
Node Compare 之前的优先级低于"加固"；协作编辑、支付、自定义域名都太早。

---

## 10. 已知限制（诚实清单）

| 限制 | 说明 |
| --- | --- |
| 数据在浏览器 localStorage + 云端 | 换设备需登录；清理浏览器数据会丢本机副本 |
| 免费版无自动备份（已用 Actions 兜底） | 备份存在 GitHub artifact，保留 90 天 |
| 多设备同时编辑 | 已做冲突保底：自动保留两份并提示，不再静默丢数据 |
| 知识地图生成 | 逐个卡片串行调用，卡片多时较慢 |
| 大项目地图性能 | 节点多时拖动会重算全图 |
| 主题直链 | 仅在同设备有效（数据未公开分享） |
| 移动端 | 基础适配完成，真机细节仍需打磨 |

---

## 11. 交接时的当前状态

```text
版本         V0.6.14
最新提交     （见 git log -1）
分支         main 与 v0.6.14 已同步
部署         ✅ GitHub Pages 自动部署正常
备份         ✅ 每天 02:40（北京时间）自动运行，已实测
保活         ✅ 每天 10:10 自动运行
数据库       ✅ schema.sql 全部执行完毕（含容量保护，已实测生效）
```

### 遗留的测试账号

```text
ts.verify.a@gmail.com
密码 TestPass12345
```

用于 `npm run cloud-check`。用户可随时在 Supabase → Authentication → Users 删除。

> `ts.verify.b@gmail.com` 已在 V0.6.2 实测「自助删除账号」时被注销（验证通过）。

---

## 12. 给下一个 Agent 的建议

1. **先跑一遍** `npm run typecheck && npm run build && npm run smoke`，确认基线是绿的。
2. **改动前先看** `src/store/store.ts` 和 `src/types.ts`，几乎所有功能都从那里开始。
3. **加字段时不要改数据库** —— 直接加到 `content` JSON 里，旧数据用 `undefined` 兜底即可。
4. **破坏性结构变化**才需要在 `storage.ts` 的迁移函数里加一步（本地和云端都会走）。
5. **改完记得同步 README**（用户会要求）。
6. **每次改动把 `src/version.ts` 的版本号 +1**，这是用户核对部署是否成功的唯一方式。
7. **提交前不要忘记跑测试**；用户会真机验证，但我们不能把明显的问题交出去。
8. **产品判断上尊重用户** —— 他对"什么功能没人会用"的判断相当准。
