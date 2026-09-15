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

React 19 + TypeScript + Vite + Tailwind CSS v4 + @xyflow/react + zustand。
数据保存在浏览器 localStorage，当前无后端、无账号系统。

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
- **V0.4 云端**：Supabase / Auth / 云同步 / RLS（未开始，版本号保留给登录系统）
- **V0.5 公开测试**：BYOK / Provider 管理 / 限流 / 监控（未开始）

## 安全规则

- API Key 只保存在浏览器 localStorage（键名 `thinkingspace.secrets.v1`），
  不写入仓库、不参与导出。
- 不要把 API Key 硬编码进任何源码文件。
- 导出文件 `.thinkingspace.json` 只包含项目内容，不包含密钥。
