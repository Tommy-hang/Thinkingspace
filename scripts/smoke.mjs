/**
 * 冒烟测试：在 Node 环境中把整个应用渲染一次，用于在没有浏览器的前提下
 * 捕获「白屏级别」的运行错误（导入错误、组件渲染崩溃等）。
 *
 * 运行：npm run smoke
 */
import { createServer } from 'vite';
import { renderToString } from 'react-dom/server';
import React from 'react';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1280,
  innerHeight: 800,
  getSelection: () => null,
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
};

globalThis.document = {
  documentElement: { classList: { toggle() {}, add() {}, remove() {} } },
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({
    style: {},
    click() {},
    remove() {},
    appendChild() {},
    setAttribute() {},
  }),
  body: { appendChild() {}, removeChild() {} },
};

globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const server = await createServer({
  root: process.cwd(),
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

let failed = false;
const checks = [];
const check = (name, ok) => {
  checks.push([name, Boolean(ok)]);
  if (!ok) failed = true;
};

try {
  const appMod = await server.ssrLoadModule('/src/App.tsx');
  const App = appMod.default;
  const html = renderToString(React.createElement(App));

  check('品牌名 ThinkingSpace', html.includes('ThinkingSpace'));
  check('地图容器', html.includes('react-flow'));
  check('侧边栏项目概述', html.includes('项目概述'));
  check('示例主题卡', html.includes('Transformer'));

  // --- Markdown + KaTeX 渲染管线 ---
  const mdMod = await server.ssrLoadModule('/src/components/Markdown.tsx');
  const sample = [
    '## 二级标题',
    '',
    '行内公式 $a^2+b^2=c^2$ 测试。',
    '',
    '$$',
    '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
    '$$',
    '',
    '```js',
    'const answer = 42;',
    '```',
  ].join('\n');
  const mdHtml = renderToString(React.createElement(mdMod.Markdown, { content: sample }));

  check('Markdown 标题渲染', mdHtml.includes('<h2'));
  check('KaTeX 行内公式', mdHtml.includes('class="katex"'));
  check('KaTeX 块级公式', mdHtml.includes('katex-display'));
  check('代码块高亮', mdHtml.includes('hljs'));

  // --- Focus View 渲染 ---
  const storeMod = await server.ssrLoadModule('/src/store/store.ts');
  const state = storeMod.useStore.getState();
  const node = state.nodes.find((n) => state.messages.some((m) => m.nodeId === n.id));

  if (!node) {
    check('Focus View 有可测试节点', false);
  } else {
    const focusMod = await server.ssrLoadModule('/src/components/FocusView.tsx');
    const focusHtml = renderToString(
      React.createElement(focusMod.FocusView, {
        nodeId: node.id,
        originRect: null,
        onClose() {},
      }),
    );
    check('Focus View 返回按钮', focusHtml.includes('返回地图'));
    check('Focus View 渲染 Markdown', focusHtml.includes('ts-markdown'));
    check('Focus View 模型切换器', focusHtml.includes('离线演示') || focusHtml.includes('mock'));
  }

  // --- 本轮新增的纯逻辑 ---
  const treeMod = await server.ssrLoadModule('/src/lib/tree.ts');
  const intentMod = await server.ssrLoadModule('/src/lib/branchIntent.ts');
  const exportMod = await server.ssrLoadModule('/src/lib/branchExport.ts');
  const linkMod = await server.ssrLoadModule('/src/lib/link.ts');

  const t = (id, parentId, extra = {}) => ({
    id,
    projectId: 'p1',
    parentId,
    title: id,
    summary: '',
    position: { x: 0, y: 0 },
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  });

  const demoNodes = [t('A', null), t('B', 'A'), t('C', 'B'), t('D', 'B'), t('F', 'A')];

  check('getAncestors 返回完整祖先链', treeMod.getAncestors(demoNodes, 'C').map((n) => n.id).join('>') === 'A>B>C');
  check('getDescendantIds 统计后代', treeMod.getDescendantIds(demoNodes, 'B').size === 2);

  const collapsedNodes = demoNodes.map((n) => (n.id === 'B' ? { ...n, collapsed: true } : n));
  const visible = treeMod.getVisibleNodes(collapsedNodes).map((n) => n.id).sort().join(',');
  check('折叠后隐藏后代', visible === 'A,B,F');

  const md = exportMod.exportBranchMarkdown(demoNodes, [], 'A');
  check('Markdown 导出保留层级', md.includes('# A') && md.includes('## B') && md.includes('### C'));

  check(
    'Branch Intent 生成问题',
    intentMod.buildIntentQuestion('counterexample', 'X').includes('反例'),
  );
  check('intent 映射到边类型', intentMod.intentToEdgeType('counterexample') === 'contrast');
  check('链接解析', linkMod.parseNodeHash('#/p/p1/n/n2')?.nodeId === 'n2');
  check('非法链接安全返回', linkMod.parseNodeHash('') === null);

  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
  console.log(`\nApp 渲染长度：${html.length} / Markdown 渲染长度：${mdHtml.length}`);
} catch (err) {
  console.error('RENDER_FAIL');
  console.error(err);
  failed = true;
} finally {
  await server.close();
}

console.log(failed ? '\n冒烟测试失败' : '\n冒烟测试通过');
process.exit(failed ? 1 : 0);
