# ThinkingSpace 零基础完整开发手册

## 0. 这份手册适合谁

这份手册专门按照以下前提设计：

* 你没有编程经验。
* 你不会自己写 React、TypeScript、SQL。
* 你已经安装 Node.js、Git、VS Code。
* 你已经注册 GitHub。
* 绝大多数代码由 Codex 等 AI Coding Agent 完成。
* 你负责产品方向、视觉判断、功能验收和最终决策。
* 第一阶段只开发网页版。
* 第一阶段主要由你自己使用。
* 模型首先接入 DeepSeek API。
* 后期支持用户 BYOK，也就是用户自己填写自己的 API Key。
* 后期才加入账号登录和云同步。
* 最终产品部署到互联网，任何用户通过浏览器访问。

---

# 第一章：先建立正确的开发观念

你不是要“先学会编程，再开发 ThinkingSpace”。

你真正要建立的是一套：

> 人负责产品决策，AI 负责代码执行，Git 负责防止事故。

的工作方式。

整个系统可以理解成：

```text
你
│
├── ChatGPT
│   ├ 产品设计
│   ├ 架构讨论
│   ├ 技术解释
│   └ 帮你撰写 Codex 任务
│
├── Codex
│   ├ 阅读项目
│   ├ 写代码
│   ├ 修改代码
│   ├ 运行命令
│   ├ 测试
│   └ 修 Bug
│
├── Git
│   └ 保存每一个可靠版本
│
├── GitHub
│   └ 云端保存源代码
│
├── Vercel
│   └ 发布网页
│
├── DeepSeek
│   └ 提供真正的 AI 模型
│
└── Supabase（后期）
    ├ 用户登录
    ├ 数据库
    └ 云端项目同步
```

你不需要亲自编写代码。

但是建议逐渐理解几个概念：

```text
文件
文件夹
终端
npm
开发服务器
Git commit
GitHub repository
API
API Key
数据库
部署
```

目标不是让你成为程序员，而是让你能够理解 AI 正在帮你做什么。

---

# 第二章：我们的完整技术路线

第一版推荐：

```text
React
TypeScript
Vite
Tailwind CSS
React Flow / XYFlow
LocalStorage / IndexedDB
DeepSeek API
Git
GitHub
Vercel
```

后续增加：

```text
Supabase
├ Auth
├ PostgreSQL
└ Row Level Security
```

React Flow 当前官方包名为：

```text
@xyflow/react
```

它已经提供节点拖拽、缩放、平移、选择、连接等大量底层能力，非常适合我们的 Conversation Map。

---

# 第三章：第一件事——检查电脑环境

打开 VS Code。

顶部选择：

```text
Terminal
→
New Terminal
```

Windows 中文界面可能显示：

```text
终端
→
新建终端
```

底部会出现命令窗口。

输入：

```bash
node -v
```

按 Enter。

然后输入：

```bash
npm -v
```

再输入：

```bash
git --version
```

只要三个命令都有版本号，说明基础环境正常。

注意：当前 Vite 官方要求较新的 Node.js，文档注明支持 Node.js 20.19+ 或 22.12+ 等兼容版本。如果创建项目时报 Node 版本过低，应先升级 Node，而不是让 AI 强行绕过。

---

# 第四章：建立 ThinkingSpace 项目文件夹

建议在电脑上建立一个专门保存开发项目的位置，比如：

```text
D:\Projects\
```

在里面建立：

```text
D:\Projects\thinkingspace
```

不要使用：

```text
桌面\新建文件夹(7)\
```

这种目录。

长期项目最好拥有固定、简洁、英文路径。

然后：

1. 打开 VS Code。
2. 点击 File。
3. 点击 Open Folder。
4. 选择 `thinkingspace` 文件夹。

以后每次开发 ThinkingSpace，都打开这个目录。

---

# 第五章：创建 Git 仓库

在 VS Code 终端中执行：

```bash
git init
```

它的意思不是“上传代码”。

它只是告诉电脑：

> 从现在开始，请追踪这个文件夹发生的代码变化。

Git 是你的保险系统。

以后：

```text
Version A
↓
修改
↓
Version B
↓
修改失败
↓
回到 Version A
```

都依靠 Git。

---

# 第六章：让 Codex 创建项目，而不是你自己写代码

这里开始进入最适合你的开发模式。

第一次打开 Codex 后，不要直接说：

> 给我做一个完整 ThinkingSpace。

而应该先把基础工程创建稳定。

给 Codex：

```text
我们正在开发一个名为 ThinkingSpace 的网页版 AI 思维空间产品。

我是完全没有编程经验的产品设计者，所有代码工作都需要你完成。

请在当前文件夹中创建一个正式可维护的前端项目。

技术栈：

React
TypeScript
Vite
Tailwind CSS
@xyflow/react

要求：

1. 使用清晰、专业、可扩展的项目结构。
2. 不要加入 Supabase。
3. 暂时不要加入用户系统。
4. 暂时不要加入 DeepSeek。
5. 只建立干净的项目骨架。
6. 完成后自行运行 npm install。
7. 自行运行项目并检查是否存在错误。
8. 如果产生错误，请自行修复。
9. 不要要求我手动编写代码。
10. 完成后向我解释：
   - 创建了哪些主要文件
   - 如何启动项目
   - 浏览器打开哪个地址
```

Codex 应该完成项目初始化。

Vite 官方支持直接创建 React + TypeScript 模板；当前官方创建方式仍基于 `npm create vite@latest`。

---

# 第七章：第一次启动网页

正常情况下，Codex最后会执行类似：

```bash
npm run dev
```

终端应该出现类似：

```text
Local:
http://localhost:5173/
```

注意：

```text
localhost
```

不是互联网网站。

它代表：

> 这个网站现在只运行在你自己的电脑上。

按住 Ctrl 点击这个地址，或者复制到浏览器。

如果能看到网页，说明：

```text
Node
↓
Vite
↓
React
↓
浏览器
```

整个基础链路已经成功。

这是第一个重要里程碑。

---

# 第八章：建立 AGENTS.md

这个文件对你非常重要。

让 Codex 创建：

```text
AGENTS.md
```

建议内容包括：

```text
# ThinkingSpace AI Development Rules

项目所有者没有编程经验。

## 开发原则

1. 所有代码修改由 AI 完成。
2. 不要求项目所有者手动编写代码。
3. 需要人工操作时必须给出完整的逐步说明。
4. 所有终端命令必须可直接复制。
5. 修改代码前先阅读相关文件。
6. 不要为了实现小功能大面积重写现有项目。
7. 修改完成后必须运行测试或构建检查。
8. 出错时优先自行定位和修复。
9. 不要忽略 TypeScript 错误。
10. 不要隐藏重要错误。
11. 删除文件、数据库或重要配置前必须明确说明风险。
12. 不允许在代码中硬编码 API Key。
13. 所有敏感密钥必须使用安全方式处理。
14. 每次完成可靠功能后建议创建 Git commit。
15. 优先保持架构简单。
16. 不要提前加入当前阶段不需要的复杂技术。
17. 用户体验优先于技术炫技。
18. Conversation Map 是产品核心。
```

以后 Codex 每次工作前都能拥有稳定规则。

---

# 第九章：建立 GitHub 仓库

登录 GitHub。

点击：

```text
New repository
```

仓库名称建议：

```text
thinkingspace
```

初期建议：

```text
Private
```

因为项目仍在快速开发。

GitHub 创建完成后，会显示一段类似：

```bash
git remote add origin ...
```

不要自己猜。

直接把 GitHub 页面提供的仓库地址交给 Codex：

> 请把当前本地 Git 仓库连接到这个 GitHub repository，并完成第一次 commit 和 push。

让 Codex操作即可。

---

# 第十章：理解 Commit

以后一定记住：

> Commit = 游戏存档。

例如：

```text
Commit 1
Initial project setup

Commit 2
Conversation map prototype

Commit 3
Focus view

Commit 4
Branch creation

Commit 5
DeepSeek integration
```

当 Commit 5 出问题：

```text
可以返回 Commit 4
```

所以每当你看到：

> “现在这个版本很好。”

就告诉 Codex：

```text
当前版本运行正常，我很满意。

请：
1. 检查 git diff。
2. 确认没有敏感信息。
3. 创建一个清晰的 commit。
4. push 到 GitHub。
5. 告诉我 commit 做了什么。
```

---

# 第十一章：第一阶段真正开发什么

第一阶段完全不要碰：

```text
用户注册
用户密码
数据库
支付
订阅
复杂 Agent
向量数据库
多人协作
OAuth
```

第一阶段只证明：

> “树形/地图式 AI 对话是不是比传统 Chat 更好。”

我们先实现：

```text
Map View
↓
Topic Card
↓
Focus View
↓
返回 Map
↓
创建 Branch
↓
拖动节点
↓
保存地图
```

---

# 第十二章：Conversation Map

让 Codex 使用：

```text
@xyflow/react
```

React Flow 官方 Quick Start 当前安装命令是：

```bash
npm install @xyflow/react
```

同时 React Flow 要求正确导入自己的 CSS，并且画布父容器必须具有明确宽高。

你不用执行这些。

你可以直接给 Codex：

```text
现在开始实现 ThinkingSpace 的核心 Conversation Map。

要求：

1. 使用 @xyflow/react。
2. 页面主体是无限画布。
3. 支持平移。
4. 支持缩放。
5. 支持拖动节点。
6. 每个节点是一张 Topic Card，而不是单条消息。
7. 卡片至少显示：
   - 标题
   - 简短摘要
   - 对话轮数
   - 分支数量
8. 节点之间使用连线表达父子 Branch。
9. 点击卡片进入 Focus View。
10. 当前阶段使用 mock data。
11. 不接 AI。
12. 不接数据库。
13. 页面风格克制、高级、现代。
14. 不要做俗套赛博朋克视觉。
15. 修改完成后运行项目并检查错误。
```

---

# 第十三章：Focus View

点击 Node 后不要弹小窗口。

应该形成明显空间转换：

```text
Map
↓
Card expand
↓
Focus
```

Focus View 包含：

```text
标题
父节点路径
用户问题
AI回答
后续对话
Branch
输入框
返回地图
```

告诉 Codex：

```text
现在实现 Focus View。

目标：

用户点击 Map 中的 Topic Card 后进入沉浸式完整页面。

要求：

1. Focus View 全屏。
2. 顶部提供 Back to Map。
3. 保留当前 Topic 标题。
4. 展示该 Topic 内完整 Conversation。
5. 底部有输入区域。
6. 返回地图后保持原来的：
   - 缩放
   - 位置
   - 选中节点
7. 尽可能建立空间连续感。
8. 暂时使用 mock conversation。
```

---

# 第十四章：Branch

这是产品最核心的创新之一。

用户应该可以：

```text
当前主题
↓
选择某段文字
↓
Ask / Branch
↓
产生新的 Topic Node
```

第一阶段甚至不用实现非常复杂的文本 selection。

可以先加：

```text
Create Branch
```

按钮验证结构。

数据结构至少要有：

```text
Node

id
title
summary
position
parentId
```

以及：

```text
Edge

source
target
type
```

初期：

```text
type = branch
```

但未来允许：

```text
reference
contrast
dependency
example
```

---

# 第十五章：第一阶段本地保存

现在不要 Supabase。

让浏览器保存：

```text
projects
nodes
edges
messages
```

可以先使用 LocalStorage。

以后数据复杂后再迁移 IndexedDB 或 Supabase。

你只需要测试：

```text
移动一个节点
↓
刷新浏览器
↓
节点仍然在那里
```

如果成立，本地持久化成功。

---

# 第十六章：第一个可用版本应该是什么样

达到以下状态后暂停加功能：

```text
打开网站

↓
看到 Conversation Map

↓
创建 Topic

↓
点击 Topic

↓
进入 Focus

↓
添加几轮本地模拟对话

↓
创建 Branch

↓
地图出现新的子 Topic

↓
拖动 Node

↓
刷新

↓
状态仍存在
```

这时已经形成：

**ThinkingSpace V0.1 Prototype**

---

# 第十七章：接入 DeepSeek

只有 V0.1 UI 真正好用之后，再做这一步。

DeepSeek 当前官方 API 提供 OpenAI/Anthropic 兼容格式；官方文档当前给出的 OpenAI-compatible `base_url` 为：

```text
https://api.deepseek.com
```

模型名称可能随着 DeepSeek 更新而变化，因此实现时不要在产品大量位置写死模型名，而要做配置层。

建议告诉 Codex：

```text
现在开始为 ThinkingSpace 加入统一 AI Provider 层。

当前首个 Provider 为 DeepSeek。

要求：

1. 不要把 DeepSeek 逻辑散落在 UI 中。
2. 建立统一 AI Provider abstraction。
3. Provider 至少包含：
   - provider id
   - display name
   - base URL
   - model
   - API Key source
4. 首先接入 DeepSeek。
5. 使用流式输出。
6. UI 能显示生成中的文字。
7. 允许后期增加：
   - OpenAI
   - Anthropic
   - OpenRouter
   - OpenAI-compatible custom provider
8. 不允许把我的 API Key 写进 Git 仓库。
```

---

# 第十八章：你的 DeepSeek Key

你自己前往 DeepSeek 官方平台创建 API Key。

API Key 一般类似：

```text
sk-xxxxxxxx
```

永远不要：

```text
截图发到公开论坛
提交 GitHub
写进 README
硬编码到 JS 文件
```

初期个人开发，可以通过本地环境变量管理你的开发 Key。

例如：

```text
.env.local
```

并确保：

```text
.env*
```

受到 `.gitignore` 保护。

任何时候都可以问 Codex：

> 请检查当前 Git 仓库有没有可能泄露 API Key。

---

# 第十九章：BYOK 设计

未来公开产品采用：

**Bring Your Own Key**

用户进入：

```text
Settings
→
AI Providers
→
DeepSeek
```

填写：

```text
API Key
```

产品不承担模型费用。

第一阶段可以优先设计：

```text
API Key只存在当前浏览器
```

不要立即实现：

```text
API Key 云同步
```

后者涉及更严肃的加密和安全责任。

---

# 第二十章：Context Engine

ThinkingSpace 真正的技术创新不只是 Map。

它可以利用树结构决定：

> 模型真正应该看到哪些上下文。

传统聊天：

```text
全部历史
↓
全部发送
```

ThinkingSpace：

```text
Project Summary
↓
Ancestor Summary
↓
Parent Topic Summary
↓
Current Topic Conversation
↓
Selected Anchor
↓
Current Question
```

例如：

```text
Transformer
↓
Attention
↓
Multi-head
↓
当前问题
```

模型不需要知道：

```text
用户曾经研究的无关 CSS 问题
```

这可以降低：

```text
Token 消耗
上下文噪声
模型注意力污染
```

未来让 Codex单独实现：

```text
Context Builder
```

而不是把这个逻辑写死在 Chat 组件里。

---

# 第二十一章：Branch Context

用户从一句话：

```text
每个 Head 可以学习不同关系
```

创建 Branch。

Branch 应存：

```text
sourceNodeId
sourceMessageId
anchorText
parentContextSummary
```

新 Topic 第一次调用 AI 时发送：

```text
父主题摘要
+
被选中文字
+
新问题
```

而不是复制整个历史。

---

# 第二十二章：第一次部署到互联网

当本地版本稳定后注册：

```text
Vercel
```

然后：

```text
Sign in with GitHub
```

授权你的 repository。

点击：

```text
Import Project
```

选择：

```text
thinkingspace
```

Vercel 会识别前端项目。

部署完成以后得到：

```text
https://xxxx.vercel.app
```

这就是你的第一个公开网站。

以后 GitHub push 可以自动触发新的部署，这也是推荐使用 GitHub → Vercel 工作流的重要原因。

---

# 第二十三章：开发环境与正式网站

以后记住：

```text
localhost
=
你的实验室
```

例如：

```text
http://localhost:5173
```

而：

```text
xxxx.vercel.app
=
正式网站
```

不要在正式网站直接试危险修改。

推荐流程永远是：

```text
Codex修改
↓
本地运行
↓
你验收
↓
测试
↓
commit
↓
push
↓
Vercel deploy
```

---

# 第二十四章：什么时候加入 Supabase

当出现以下需求时：

```text
换电脑后还要看到项目
用户注册
不同用户不能互相看到项目
多个 Project 云端同步
```

才加入 Supabase。

Supabase Auth 当前支持密码、Magic Link、OTP、社交登录等多种方式，并能与数据库权限结合。

我们第一版公开登录建议甚至只选择一种：

```text
Email + Magic Link
```

或者：

```text
Email + Password
```

不要同时做五六种登录方式。

---

# 第二十五章：未来数据库

推荐基础结构：

```text
profiles

projects

nodes

edges

messages
```

例如：

```text
projects
id
user_id
title
summary
created_at
updated_at
```

```text
nodes
id
project_id
parent_id
title
summary
x
y
status
created_at
updated_at
```

```text
messages
id
node_id
role
content
created_at
```

```text
edges
id
project_id
source_node_id
target_node_id
type
created_at
```

---

# 第二十六章：为什么 Supabase RLS 很重要

以后每一个项目都属于：

```text
user_id
```

用户 A：

```text
只能读取 user_id = A
```

Supabase 当前推荐使用 PostgreSQL Row Level Security，把权限规则直接放在数据库层。官方文档也明确强调，对暴露给客户端的数据表需要正确启用 RLS，并用 Policy 控制访问。

这一部分绝对不要让 AI：

> “先为了方便全部 public。”

上线前必须做权限审查。

---

# 第二十七章：你的标准开发循环

以后你每天开发其实就是：

```text
打开 VS Code

↓

打开 thinkingspace 文件夹

↓

打开 Codex

↓

告诉它：
先阅读项目和 AGENTS.md，不修改代码

↓

给出今天一个明确任务

↓

Codex修改

↓

Codex运行测试

↓

你打开 localhost

↓

你实际点击体验

↓

发现问题
截图 + 描述

↓

Codex修复

↓

满意

↓

Git commit

↓

GitHub push

↓

Vercel自动发布
```

你会逐渐发现：

你真正需要掌握的是：

**验收能力，而不是代码输入能力。**

---

# 第二十八章：给 Codex 的万能开场提示词

以后新会话可以直接使用：

```text
你正在继续开发 ThinkingSpace。

请首先：

1. 阅读 AGENTS.md。
2. 阅读 package.json。
3. 阅读 README。
4. 浏览 src 主要目录。
5. 查看当前 git status。
6. 理解现有架构。
7. 暂时不要修改任何代码。

然后用非程序员能够理解的语言告诉我：

- 当前项目完成到什么阶段
- 当前主要模块是什么
- 有没有明显错误
- 哪些文件最关键

我是完全没有编程经验的项目所有者。

所有代码工作由你完成。

如果需要我进行任何人工操作，请使用：
“点击哪里 → 输入什么 → 应该看到什么”
的方式告诉我。
```

---

# 第二十九章：给 Codex 的标准开发任务模板

```text
【任务名称】
实现 XXX

【用户体验目标】
用户应该能够……

【当前行为】
现在……

【期望行为】
应该……

【要求】
1.
2.
3.

【禁止事项】
- 不要破坏已有功能
- 不要大面积重构无关文件
- 不要硬编码敏感信息
- 不要隐藏错误

【完成标准】
1. 功能可运行
2. TypeScript 无新增错误
3. build 成功
4. 关键流程经过测试
5. 向我说明修改内容

我是非程序员。
请自行完成代码修改和必要命令。
```

---

# 第三十章：遇到 Bug 怎么办

不要尝试自己修。

例如浏览器出现：

```text
白屏
```

你告诉 Codex：

```text
刚才修改以后浏览器变成白屏。

请：
1. 检查开发服务器日志。
2. 检查浏览器相关错误。
3. 阅读本次 git diff。
4. 定位真正原因。
5. 修复。
6. 不要通过删除功能来掩盖错误。
7. 修复后重新运行测试。
```

如果仍然不行：

```text
请比较当前版本和上一个正常 commit。
找出导致回归的修改。
```

Git 在这里发挥最大价值。

---

# 第三十一章：不要一次让 AI 做十个功能

错误：

```text
做登录、地图、AI、数据库、分享、支付、主题、搜索……
```

正确：

```text
一次一个垂直切片。
```

例如：

```text
今天：
Map → Focus

明天：
Focus → Branch

后天：
Local Persistence
```

AI 在边界清楚的任务上可靠性会显著更高。

---

# 第三十二章：开发阶段路线图

## V0.1 — Interaction Prototype

目标：

```text
Map
Card
Focus
Branch
Local persistence
```

没有真正 AI。

---

## V0.2 — AI Prototype

增加：

```text
DeepSeek
Streaming
Context Builder
Branch context
```

只有你使用。

---

## V0.3 — Personal Daily Driver

增加：

```text
Project management
Search
Node status
Better layout
Export / Import
Settings
```

目标：

> 你自己每天愿意用。

---

## V0.4 — Cloud Beta

增加：

```text
Supabase
Auth
Cloud persistence
RLS
```

---

## V0.5 — Public Beta

增加：

```text
BYOK
Provider management
Rate limit
Error monitoring
Privacy
Onboarding
```

---

## V1.0 — Mature Thinking Workspace

考虑：

```text
Semantic zoom
Automatic topic clustering
Branch merge
Project summaries
Knowledge links
Conversation graph
Knowledge graph
Search
Export
Collaboration
```

---

# 第三十三章：一个最重要的开发原则

不要让工程把产品拖走。

我们的判断优先级应该永远是：

```text
用户认知体验
>
交互清晰度
>
稳定性
>
代码优雅
>
技术炫技
```

ThinkingSpace 的竞争力不是：

> 使用了多少先进库。

而是：

> 是否真的让人与 AI 的复杂思考变得比传统聊天更自然。

---

# 第三十四章：你现在应该做什么

现在不要注册 Supabase。

不要先搞登录。

不要先配置 DeepSeek。

第一步只做：

```text
本地 ThinkingSpace
+
Conversation Map
+
Topic Card
+
Focus View
+
Branch
```

如果这个核心交互成立，我们才继续建设后面的系统。

**产品灵魂先成立，基础设施随后补上。**
