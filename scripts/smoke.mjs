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

  const hiddenNodes = demoNodes.map((n) => (n.id === 'B' ? { ...n, hidden: true } : n));
  check('隐藏自身连带隐藏后代', [...treeMod.getHiddenIds(hiddenNodes)].sort().join(',') === 'B,C,D');
  check(
    '隐藏后可见节点',
    treeMod.getVisibleNodes(hiddenNodes).map((n) => n.id).sort().join(',') === 'A,F',
  );

  const titleMod = await server.ssrLoadModule('/src/lib/title.ts');
  check(
    'localTitle 提取知识点标题',
    titleMod.localTitle('问题', '### 注意力分数的缩放\n\n正文') === '注意力分数的缩放',
  );
  check(
    'localTitle 跳过通用小标题',
    titleMod.localTitle('问题', '### 你问的是\n\n内容\n\n### QKV 的分工\n\n正文') === 'QKV 的分工',
  );
  check('localSummary 去掉换行', !titleMod.localSummary('第一行\n\n第二行').includes('\n'));

  // --- 推理能力（V0.3.5）---
  const reasoningMod = await server.ssrLoadModule('/src/lib/reasoning.ts');
  const mentionMod = await server.ssrLoadModule('/src/lib/mention.ts');
  const mockProvider = {
    id: 'mock',
    displayName: '离线演示',
    baseUrl: '',
    model: 'mock',
    kind: 'mock',
    enabled: true,
  };
  const sampleAnswer = '### 注意力分数的缩放\n\n除以 √dk 是为了防止点积方差随维度爆炸。';

  const digest = await reasoningMod.generateDigest({
    provider: mockProvider,
    apiKey: '',
    content: '',
    fallbackQuestion: '为什么要除以根号 dk？',
    fallbackAnswer: sampleAnswer,
  });
  check('generateDigest 离线回退到知识点标题', digest.title === '注意力分数的缩放');
  check('generateDigest 生成当前理解', digest.summary.includes('点积方差'));

  const suggestions = await reasoningMod.generateSuggestions({
    provider: mockProvider,
    apiKey: '',
    question: '为什么要除以根号 dk？',
    answer: sampleAnswer,
  });
  check(
    'generateSuggestions 离线回退为 3 个方向',
    suggestions.length === 3 && suggestions.every((s) => s.intent && s.question),
  );

  const insight = reasoningMod.localInsight('Attention', [
    { ...t('QKV', 'Attention'), title: 'QKV', summary: '三种角色分工' },
    { ...t('Softmax', 'Attention'), title: 'Softmax', summary: '归一化成权重' },
  ]);
  check('localInsight 汇总子分支结论', insight.includes('三种角色分工') && insight.includes('归一化成权重'));

  const mentionNodes = [
    { ...t('n1', null), title: 'Attention' },
    { ...t('n2', null), title: 'CNN' },
  ];
  check(
    '@ 引用解析出两个主题',
    mentionMod.extractMentions('请比较 @Attention 和 @CNN 的差异', mentionNodes).length === 2,
  );
  check('firstSentence 提取首句', mentionMod.firstSentence('这是第一句。这是第二句。') === '这是第一句');

  // --- 待解决问题：旧版「存在主题上」迁移到「项目级共享」 ---
  const storageMod = await server.ssrLoadModule('/src/lib/storage.ts');
  const legacyProjects = [
    { id: 'p1', title: 'P', summary: '', createdAt: 0, updatedAt: 0 },
  ];
  const legacyNodes = [
    {
      id: 'n1',
      projectId: 'p1',
      parentId: null,
      title: 'N',
      summary: '',
      position: { x: 0, y: 0 },
      status: 'active',
      openQuestions: [{ id: 'q1', text: '为什么', createdAt: 0 }],
      createdAt: 0,
      updatedAt: 0,
    },
  ];
  const migrated = storageMod.migrateOpenQuestions(legacyProjects, legacyNodes);
  check(
    '旧版待解决问题迁移到项目级',
    migrated.projects[0].openQuestions.length === 1 &&
      migrated.projects[0].openQuestions[0].sourceNodeId === 'n1',
  );
  check('迁移后主题不再携带 openQuestions', migrated.nodes[0].openQuestions === undefined);
  check('无旧数据时原样返回', storageMod.migrateOpenQuestions(legacyProjects, []).nodes.length === 0);

  // --- 知识地图（V0.3.6）---
  const kmMod = await server.ssrLoadModule('/src/lib/knowledgeMap.ts');
  const kmItems = [
    { id: 'n1', title: '注意力机制', summary: 'QKV 分工与缩放点积' },
    { id: 'n2', title: '位置编码', summary: '把顺序信息注入模型' },
  ];
  const localMap = kmMod.localKnowledgeMap('Transformer 学习', kmItems);
  check('知识地图兜底生成根节点', localMap.root.label === 'Transformer 学习');
  check('知识地图兜底挂上来源卡片', localMap.root.children[0].sourceNodeIds[0] === 'n1');

  const flatPoints = kmMod.flattenKnowledge(localMap.root);
  check('知识点展开包含根与子节点', flatPoints.length === 3 && flatPoints[0].depth === 0);
  check(
    '知识点父子关系正确',
    flatPoints[1].parentId === localMap.root.id && flatPoints[1].depth === 1,
  );
  check('知识点计数', kmMod.countKnowledgePoints(localMap.root) === 3);

  const aiMap = await kmMod.generateKnowledgeMap({
    provider: mockProvider,
    apiKey: '',
    projectTitle: 'Transformer 学习',
    items: kmItems,
  });
  check('generateKnowledgeMap 离线回退可用', aiMap.root.children.length === 2);

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
