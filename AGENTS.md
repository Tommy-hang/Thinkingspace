> **新会话请先读 `HANDOFF.md`**（项目全貌、已完成/待办、踩过的坑、交接状态）。

这是一个由非程序员维护的项目。

用户不会编程。

任何操作必须：

1. 修改前先解释要做什么
2. 尽量直接完成代码修改
3. 修改完成后运行测试
4. 出错时自行分析和修复
5. 如果需要用户手动操作，
   必须提供逐步说明
6. 不要要求用户自己写代码
7. 所有终端命令给出完整可复制命令
8. 涉及删除数据库、文件或重大配置前明确警告

---

# ThinkingSpace 项目规则

## 项目定位

ThinkingSpace 是一个以 Topic 为基本认知单元、以 Branch 为思考扩展机制、
以 Map 为全局导航界面、以 AI 为协作伙伴的非线性思维工作空间。

**Conversation Map 是产品核心。**

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS v4 + @xyflow/react + zustand + Supabase。
数据保存在浏览器 localStorage；登录后同步到 Supabase，纯前端、无自建后端。

## 常用命令（可直接复制）

| 目的 | 命令 |
| --- | --- |
| 安装依赖 | `npm install` |
| 启动开发服务器 | `npm run dev` |
| 类型检查 | `npm run typecheck` |
| 生产构建 | `npm run build` |
| 冒烟测试（渲染检查） | `npm run smoke` |
| 预览构建产物 | `npm run preview` |

开发服务器地址：http://localhost:5173

## 目录结构

- `src/types.ts` — 数据模型与状态定义
- `src/store/store.ts` — 全局状态与所有业务动作
- `src/lib/storage.ts` — 本地持久化（数据与密钥分开存储）
- `src/lib/ai/` — AI Provider 层（OpenAI 兼容协议 + 离线 mock）
- `src/lib/ai/contextBuilder.ts` — Context Engine（利用树结构构建上下文）
- `src/lib/layout.ts` — 自动布局
- `src/lib/exportImport.ts` — 导出 / 导入
- `src/lib/projectTransfer.ts` — 跨项目拆分 / 复制 / 整项目克隆（纯函数）
- `src/lib/usage.ts` — 云端用量估算（上限需与 `supabase/schema.sql` 保持一致）
- `src/lib/diff.ts` — 句子级差异（LCS），用于「当前理解」版本确认
- `src/lib/replay.ts` — 思考回放事件流（纯函数）
- `src/lib/markdown.ts` — 公式分隔符归一（`\[..\]` / `\(..\)` → `$` / `$$`）
- `src/components/` — 界面组件
- `scripts/smoke.mjs` — 冒烟测试

## 版本路线

- **V0.1 交互原型**：Map / Topic Card / Focus View / Branch / 本地保存 ✅
- **V0.2 AI 原型**：Provider 层 / DeepSeek 流式 / Context Builder / Branch Context ✅
- **V0.3 个人日常使用**：项目管理 / 搜索 / 节点状态 / 布局 / 导入导出 / 设置 ✅
  - **V0.3.1**：Markdown / KaTeX 渲染、V4 模型与思考模式、联网搜索 ✅
  - **V0.3.2**：GitHub Pages 自动部署 ✅
  - **V0.3.3**：撤销重做 / 子树折叠 / 思考路径高亮 / 最近 / 收藏 / 主题直链 / 分支意图 / Markdown 导出 / 编辑重生成 / 悬停预览 ✅
  - **V0.3.4**：使用说明面板 / AI 按核心知识点自动生成标题 / 卡片与侧栏树右键菜单 / 隐藏自身与隐藏子分支 ✅
  - **V0.3.5**：推理工作空间 —— 当前理解（Topic Summary）/ 待解决问题（Open Questions）/ AI 探索方向建议 / 综合理解（Merge Insights）/ @ 引用主题 ✅
  - **V0.3.6**：知识地图 —— 由全部卡片的「当前理解」生成整个项目的知识点思维导图，知识点下方标注来源卡片并可点击定位 ✅
- **V0.4 云端**：Supabase Auth（GitHub / 邮箱）+ 项目云同步 + RLS 行级隔离 ✅
  - 配置：`.env.local` 填 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`；GitHub Actions 用同名 Secrets
  - 建表：`supabase/schema.sql` 粘到 Supabase SQL Editor 执行
  - 设计：内容按项目整体存 `content jsonb`（单人/小团队场景，简单可靠）；同步在 `src/lib/cloud/engine.ts` 一层内，业务代码无感知
  - **按需加载**：同步时先只拉项目元信息，只有云端确实变过的项目才拉 `content`（省约 90% 流量）
  - **项目级同步标记**：`Project.cloudUpdatedAt` / `cloudRevision` 持久化在本地，用于判断「云端变没变」和「本地有没有未上传的改动」
  - **定时保活**：`.github/workflows/keep-alive.yml` 每天访问一次数据库，避免免费项目 7 天不活动被暂停
  - **数据迁移**：唯一入口 `migrateOpenQuestions()`（在 `src/lib/storage.ts`），本地读取与云端拉取两条路径都会调用
- **V0.5 移动端**：手机浏览器适配（抽屉侧栏 / 工具栏收纳 / 触屏常显 / 防 iOS 缩放）✅
- **V0.6 公开测试加固** ✅
  - V0.6.0 ✅ 每日自动备份（`backup.yml`，需配 `SUPABASE_DB_URL` Secret）/ 应用内反馈入口（带诊断信息）/
    容量保护（`schema.sql` 触发器：20 项目 / 20MB / 单项目 4MB）/ 手机侧栏长按菜单修复
  - V0.6.1 ✅ 卡片可拆分 / 复制到另一个项目（连同全部子分支、对话与相关待解决问题）
  - V0.6.2 ✅ 同步冲突保底（另存副本，绝不静默丢数据）/ 自助删除账号
    （`schema.sql` 的 `delete_my_account()`）/ 云端用量提示
  - V0.6.3 ✅ 上下文透镜（回答旁可见 AI 用了哪些内容）/ 综合节点（多主题收敛）/ 思考回放 /
    当前理解版本差异（+/− 确认后才生效）
  - V0.6.4 ✅ 新手教学与使用说明同步新功能
  - V0.6.5 ✅ 顶栏窄屏优化（窄屏隐藏文字 + 悬停提示）/ 修复 `\[..\]`、`\(..\)` 公式不渲染

## 安全规则

- API Key 只保存在浏览器 localStorage（键名 `thinkingspace.secrets.v1`），
  不写入仓库、不参与导出。
- 不要把 API Key 硬编码进任何源码文件。
- 导出文件 `.thinkingspace.json` 只包含项目内容，不包含密钥。
