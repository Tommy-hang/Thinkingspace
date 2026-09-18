// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 张文曜 (Tommy-hang)

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
  check('新手指引：封面海报', html.includes('让问题拥有空间'));
  check('新手指引：封面文案', html.includes('可以探索的思维空间'));
  check('新手指引：可跳过', html.includes('跳过'));

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

  const kexpMod = await server.ssrLoadModule('/src/lib/knowledgeExport.ts');
  const svg = kexpMod.buildKnowledgeSvg({
    projectTitle: 'Transformer 学习',
    root: localMap.root,
    resolveSources: (ids) =>
      ids.map((id) => (id === 'n1' ? '注意力机制' : id === 'n2' ? '位置编码' : id)),
    generatedAt: 0,
  });
  check('知识地图可导出 SVG', svg.startsWith('<svg') && svg.includes('</svg>'));
  check('SVG 含知识点文字', svg.includes('注意力机制'));
  check('SVG 含来源卡片', svg.includes('来源') || svg.includes('注意力机制'));
  check('SVG 含父子连线', svg.includes('<path'));
  check('SVG 带 viewBox 可缩放', svg.includes('viewBox='));

  const md = exportMod.exportBranchMarkdown(demoNodes, [], 'A');
  check('Markdown 导出保留层级', md.includes('# A') && md.includes('## B') && md.includes('### C'));

  check(
    'Branch Intent 生成问题',
    intentMod.buildIntentQuestion('counterexample', 'X').includes('反例'),
  );
  check('intent 映射到边类型', intentMod.intentToEdgeType('counterexample') === 'contrast');
  check('链接解析', linkMod.parseNodeHash('#/p/p1/n/n2')?.nodeId === 'n2');
  check('非法链接安全返回', linkMod.parseNodeHash('') === null);

  // --- 跨项目拆分 / 复制（V0.6.1）---
  const transferMod = await server.ssrLoadModule('/src/lib/projectTransfer.ts');
  const baseSlice = {
    projects: [
      {
        id: 'p1',
        title: '原项目',
        summary: '',
        createdAt: 0,
        updatedAt: 0,
        openQuestions: [{ id: 'q1', text: '为什么', sourceNodeId: 'B', createdAt: 0 }],
      },
      { id: 'p2', title: '目标项目', summary: '', createdAt: 0, updatedAt: 0 },
    ],
    nodes: demoNodes,
    edges: [
      { id: 'e1', projectId: 'p1', source: 'A', target: 'B', type: 'branch', createdAt: 0 },
      { id: 'e2', projectId: 'p1', source: 'A', target: 'F', type: 'branch', createdAt: 0 },
      { id: 'e3', projectId: 'p1', source: 'B', target: 'C', type: 'branch', createdAt: 0 },
      { id: 'e4', projectId: 'p1', source: 'B', target: 'D', type: 'branch', createdAt: 0 },
    ],
    messages: [
      { id: 'm1', nodeId: 'B', role: 'user', content: 'x', createdAt: 0 },
      { id: 'm2', nodeId: 'C', role: 'assistant', content: 'y', createdAt: 0 },
      { id: 'm3', nodeId: 'A', role: 'user', content: 'z', createdAt: 0 },
    ],
  };

  const moved = transferMod.moveSubtreeToProject(baseSlice, 'B', 'p2');
  check('拆分：子树移入目标项目', moved.nodes.filter((n) => n.projectId === 'p2').length === 3);
  check('拆分：子树根脱离原父节点', moved.nodes.find((n) => n.id === 'B').parentId === null);
  check('拆分：后代保持父子关系', moved.nodes.find((n) => n.id === 'C').parentId === 'B');
  check('拆分：跨越边界的连线被移除', !moved.edges.some((e) => e.id === 'e1'));
  check('拆分：子树内部连线随项目迁移', moved.edges.find((e) => e.id === 'e3').projectId === 'p2');
  check('拆分：原项目其它连线保留', moved.edges.some((e) => e.id === 'e2'));
  check(
    '拆分：待解决问题跟随来源主题',
    moved.projects.find((p) => p.id === 'p2').openQuestions.length === 1 &&
      moved.projects.find((p) => p.id === 'p1').openQuestions.length === 0,
  );
  check('拆分：对话随节点迁移', moved.messages.length === 3);
  check('拆分：节点总数不变', moved.nodes.length === baseSlice.nodes.length);
  check('拆分：拒绝移动到同一项目', transferMod.moveSubtreeToProject(baseSlice, 'B', 'p1') === null);

  const copied = transferMod.copySubtreeToProject(baseSlice, 'B', 'p2');
  const copiedInTarget = copied.nodes.filter((n) => n.projectId === 'p2');
  check('复制：目标项目新增整棵子树', copiedInTarget.length === 3);
  check('复制：生成全新的节点 id', !copiedInTarget.some((n) => ['B', 'C', 'D'].includes(n.id)));
  check('复制：原项目节点原封不动', copied.nodes.filter((n) => n.projectId === 'p1').length === 5);
  check('复制：目标项目内部连线重建', copied.edges.filter((e) => e.projectId === 'p2').length === 2);
  check('复制：对话一并复制', copied.messages.length === baseSlice.messages.length + 2);
  check(
    '复制：原项目待解决问题不受影响',
    copied.projects.find((p) => p.id === 'p1').openQuestions.length === 1,
  );
  check('复制：拒绝复制到同一项目', transferMod.copySubtreeToProject(baseSlice, 'B', 'p1') === null);

  // --- 整项目克隆（同步冲突时「保留另一份」的保底机制）---
  const clone = transferMod.cloneProject(baseSlice, 'p1', { title: '原项目 · 冲突副本' });
  check('克隆：生成新的项目 id', clone.project.id !== 'p1');
  check('克隆：标题可覆盖', clone.project.title === '原项目 · 冲突副本');
  check(
    '克隆：节点全部复制且 id 全新',
    clone.nodes.length === 5 && !clone.nodes.some((n) => ['A', 'B', 'C', 'D', 'F'].includes(n.id)),
  );
  check(
    '克隆：父子关系在副本内重建',
    clone.nodes.every((n) => n.parentId === null || clone.nodes.some((m) => m.id === n.parentId)),
  );
  check('克隆：连线全部复制', clone.edges.length === 4);
  check('克隆：对话全部复制', clone.messages.length === 3);
  check('克隆：待解决问题随副本复制', clone.project.openQuestions.length === 1);
  check('克隆：不修改原项目', baseSlice.projects.length === 2 && baseSlice.nodes.length === 5);
  check('克隆：不存在的项目返回 null', transferMod.cloneProject(baseSlice, 'nope') === null);

  // --- 用量估算 ---
  const usageMod = await server.ssrLoadModule('/src/lib/usage.ts');
  const usageProjects = [
    { id: 'p1', title: 'A' },
    { id: 'p2', title: 'B' },
  ];
  const p1Bytes = usageMod.estimateProjectBytes('p1', baseSlice.nodes, baseSlice.edges, baseSlice.messages);
  const p2Bytes = usageMod.estimateProjectBytes('p2', baseSlice.nodes, baseSlice.edges, baseSlice.messages);
  const usage = usageMod.summarizeUsage(usageProjects, baseSlice.nodes, baseSlice.edges, baseSlice.messages);
  check('用量：项目数正确', usage.projects === 2);
  check('用量：有内容的项目体积更大', p1Bytes > p2Bytes);
  check('用量：总量等于各项目之和', usage.totalBytes === p1Bytes + p2Bytes);
  check('用量：能找出最大的项目', usage.largest.id === 'p1');
  check(
    '用量：字节格式化',
    usageMod.formatBytes(0) === '0 B' &&
      usageMod.formatBytes(2048) === '2.0 KB' &&
      usageMod.formatBytes(2 * 1024 * 1024) === '2.00 MB',
  );

  // --- 上下文透镜（V0.6.3）---
  const cbMod = await server.ssrLoadModule('/src/lib/ai/contextBuilder.ts');
  const cb = cbMod.buildContext({
    project: { id: 'p1', title: '项目', summary: '项目概述', createdAt: 0, updatedAt: 0 },
    nodes: [
      { ...t('root', null), title: '根主题', summary: '根概述' },
      { ...t('child', 'root'), title: '子主题', anchor: { sourceNodeId: 'root', anchorText: '被选中的那句话' } },
      { ...t('other', null), title: '无关主题' },
    ],
    messages: [{ id: 'm1', nodeId: 'child', role: 'user', content: '问题', createdAt: 0 }],
    nodeId: 'child',
    question: '新问题',
    settings: {
      includeProjectSummary: true,
      includeAncestorSummaries: true,
      ancestorDepth: 6,
      maxAncestorChars: 240,
    },
  });
  check('透镜：返回消息与清单', Array.isArray(cb.messages) && Array.isArray(cb.manifest.parts));
  check('透镜：包含项目目标', cb.manifest.parts.some((p) => p.kind === 'project'));
  check(
    '透镜：包含上游主题',
    cb.manifest.parts.some((p) => p.kind === 'ancestor' && (p.detail ?? '').includes('根主题')),
  );
  check('透镜：包含分支锚点', cb.manifest.parts.some((p) => p.kind === 'anchor'));
  check('透镜：包含本主题对话', cb.manifest.parts.some((p) => p.kind === 'conversation'));
  check('透镜：包含当前问题', cb.manifest.parts.some((p) => p.kind === 'question'));
  check('透镜：统计未加入主题', cb.manifest.excludedTopics === 1);
  check('透镜：有字数估算', cb.manifest.totalChars > 0);

  // --- 理解版本差异（V0.6.3）---
  const diffMod = await server.ssrLoadModule('/src/lib/diff.ts');
  const dParts = diffMod.diffSentences('A。B。C。', 'A。B2。C。');
  check('差异：标出新增句', dParts.some((p) => p.type === 'add' && p.text.includes('B2')));
  check('差异：标出删除句', dParts.some((p) => p.type === 'remove' && p.text.includes('B')));
  check('差异：未变句保留', dParts.filter((p) => p.type === 'same').length === 2);
  check(
    '差异：增删计数',
    diffMod.diffSummary(dParts).added === 1 && diffMod.diffSummary(dParts).removed === 1,
  );
  check('差异：完全相同无增删', diffMod.diffSentences('X。', 'X。').every((p) => p.type === 'same'));
  check('差异：空旧文本全是新增', diffMod.diffSentences('', 'Y。').every((p) => p.type === 'add'));

  // --- 综合节点兜底（V0.6.3）---
  const localSynth = reasoningMod.localSynthesis([
    { title: 'A', summary: '甲的结论' },
    { title: 'B', summary: '乙的结论' },
  ]);
  check('综合兜底：生成标题', localSynth.title.includes('A'));
  check(
    '综合兜底：汇总结论',
    localSynth.conclusion.includes('甲的结论') && localSynth.conclusion.includes('乙的结论'),
  );
  check('综合兜底：矛盾默认为空', localSynth.contradictions === '');
  const aiSynth = await reasoningMod.generateSynthesis({
    provider: mockProvider,
    apiKey: '',
    projectTitle: 'P',
    sources: [
      { title: 'A', summary: '甲的结论' },
      { title: 'B', summary: '乙的结论' },
    ],
  });
  check('generateSynthesis 离线回退可用', aiSynth.conclusion.includes('甲的结论'));

  // --- 思考回放（V0.6.3）---
  const replayMod = await server.ssrLoadModule('/src/lib/replay.ts');
  const replay = replayMod.buildThoughtReplay(
    { id: 'p1', title: 'P', summary: 's', createdAt: 100, updatedAt: 900 },
    [
      {
        ...t('r', null),
        title: '根',
        summary: '结论',
        status: 'resolved',
        createdAt: 200,
        updatedAt: 800,
        summaryUpdatedAt: 500,
      },
      {
        ...t('c', 'r'),
        title: '子',
        status: 'parked',
        createdAt: 300,
        updatedAt: 700,
        anchor: { sourceNodeId: 'r', anchorText: '锚点文字' },
      },
    ],
    [{ id: 'm1', nodeId: 'r', role: 'user', content: '最初的问题', createdAt: 210 }],
  );
  check('回放：事件按时间排序', replay.events.every((e, i) => i === 0 || replay.events[i - 1].at <= e.at));
  check('回放：包含项目起点', replay.events.some((e) => e.kind === 'project'));
  check('回放：包含最初的问题', replay.events.some((e) => e.kind === 'topic' && (e.detail ?? '').includes('最初的问题')));
  check(
    '回放：包含分支与锚点',
    replay.events.some((e) => e.kind === 'branch' && (e.detail ?? '').includes('锚点文字')),
  );
  check('回放：包含理解更新', replay.events.some((e) => e.kind === 'understanding'));
  check('回放：统计最终结论', replay.conclusions.length === 1 && replay.conclusions[0].id === 'r');
  check('回放：统计被搁置分支', replay.abandoned.some((a) => a.id === 'c'));
  check('回放：时间范围正确', replay.startAt === 100 && replay.endAt === 500);

  // --- 公式分隔符兼容（V0.6.4）：模型输出的 \[..\] / \(..\) 也能渲染 ---
  const mdNormMod = await server.ssrLoadModule('/src/lib/markdown.ts');
  const n1 = mdNormMod.normalizeMathDelimiters('前文\n\n\\[ h_t = \\tanh(W_x x_t) \\]\n\n后文');
  check('公式分隔符：\\[..\\] 转成 $$', n1.includes('$$') && n1.includes('h_t = \\tanh'));
  check('公式分隔符：\\[..\\] 不再残留', !n1.includes('\\['));
  const n2 = mdNormMod.normalizeMathDelimiters('其中 \\(h_t\\) 是隐藏状态');
  check('公式分隔符：\\(..\\) 转成 $', n2.includes('$h_t$') && !n2.includes('\\('));
  const n3 = mdNormMod.normalizeMathDelimiters('```\n\\(x\\)\n```');
  check('公式分隔符：代码块内不改动', n3.includes('\\(x\\)'));
  const n4 = mdNormMod.normalizeMathDelimiters('`\\(y\\)` 与 \\(z\\)');
  check('公式分隔符：行内代码不改动', n4.includes('`\\(y\\)`') && n4.includes('$z$'));
  check('公式分隔符：空字符串安全', mdNormMod.normalizeMathDelimiters('') === '');

  const mdLatex = renderToString(
    React.createElement(mdMod.Markdown, { content: '行内 \\(a^2\\) 与\n\n\\[ b^2 = c^2 \\]\n' }),
  );
  check('Markdown 渲染 \\(..\\) 行内公式', mdLatex.includes('class="katex"'));
  check('Markdown 渲染 \\[..\\] 块级公式', mdLatex.includes('katex-display'));

  // --- 连线只保留有意义的结构线（V0.6.11：禁止手动随意连线）---
  const edgeNodes = [
    t('p', null),
    t('c', 'p'),
    t('x', null),
    {
      ...t('syn', null),
      synthesis: {
        sourceNodeIds: ['c'],
        sources: [],
        conclusion: '',
        contradictions: '',
        generatedAt: 0,
      },
    },
  ];
  const edgeList = [
    { id: 'tree', projectId: 'p1', source: 'p', target: 'c', type: 'branch', createdAt: 0 },
    { id: 'manual', projectId: 'p1', source: 'x', target: 'c', type: 'reference', createdAt: 0 },
    { id: 'synth', projectId: 'p1', source: 'syn', target: 'c', type: 'reference', createdAt: 0 },
  ];
  const meaningfulIds = treeMod.getMeaningfulEdges(edgeList, edgeNodes).map((e) => e.id);
  check('连线：保留父子结构线', meaningfulIds.includes('tree'));
  check('连线：保留综合节点引用线', meaningfulIds.includes('synth'));
  check('连线：过滤手动随意连线', !meaningfulIds.includes('manual'));
  check('连线：结果数量正确', meaningfulIds.length === 2);

  // --- 语义完整性：句子边界截断（V0.6.13）---
  const textMod = await server.ssrLoadModule('/src/lib/text.ts');
  check('句子截断：短文本原样返回', textMod.clipAtSentence('一句话。', 20) === '一句话。');
  check(
    '句子截断：在句末标点处收尾',
    textMod.clipAtSentence('第一句。第二句。第三句。', 9) === '第一句。第二句。',
  );
  check(
    '句子截断：无句末标点时退到逗号',
    textMod.clipAtSentence('一二三四五，六七八九十', 8) === '一二三四五，…',
  );
  check(
    '句子截断：完全没有标点才硬截',
    textMod.clipAtSentence('一二三四五六七八九十', 5) === '一二三四五…',
  );
  check('句子截断：折叠多余空白', textMod.clipAtSentence('  多   空格  ', 20) === '多 空格');

  const longAnswer = '第一点。第二点。第三点。第四点。第四点。' + '后面还有很多内容。'.repeat(20);
  check('当前理解：不再硬切半句话', titleMod.localSummary(longAnswer, 20).endsWith('。'));
  check('当前理解：默认长度已放宽', titleMod.localSummary('啊'.repeat(200)).length === 200);

  // --- Behavior Profiles（V0.6.14）---
  const behaviorMod = await server.ssrLoadModule('/src/lib/behavior.ts');
  const BP = behaviorMod.DEFAULT_BEHAVIOR_PROFILES;
  check('行为：内置 Profile 齐全', BP.length === 7);
  check('行为：默认 Profile 不产生提示词', behaviorMod.buildBehaviorPrompt(BP[0]) === '');
  const explorerPrompt = behaviorMod.buildBehaviorPrompt(
    behaviorMod.findBehavior(BP, 'explorer'),
  );
  check('行为：Explorer 生成行为提示词', explorerPrompt.includes('探索'));
  check('行为：未知 id 回退默认', behaviorMod.findBehavior(BP, 'nope').id === 'default');
  check('行为：解析优先级 Message', behaviorMod.resolveBehaviorId('g', 'c', 'm') === 'm');
  check('行为：解析优先级 Conversation', behaviorMod.resolveBehaviorId('g', 'c', undefined) === 'c');
  check('行为：解析优先级 Global', behaviorMod.resolveBehaviorId('g', undefined, undefined) === 'g');
  check(
    '行为：解析兜底 System Default',
    behaviorMod.resolveBehaviorId(undefined, undefined, undefined) === 'default',
  );
  check(
    '行为：自定义说明进入提示词',
    behaviorMod
      .buildBehaviorPrompt({
        id: 'x',
        name: 'X',
        dimensions: { focus: 2, length: 2, risk: 2, stance: 2, form: 2 },
        instructions: '给出反例',
      })
      .includes('给出反例'),
  );
  check(
    '行为：合并保留自定义 Profile',
    behaviorMod.mergeBehaviorProfiles([
      { id: 'my', name: '我的', dimensions: { focus: 2, length: 2, risk: 2, stance: 2, form: 2 } },
    ]).length === 8,
  );

  // --- 价格层（V0.6.14）---
  const pricingMod = await server.ssrLoadModule('/src/lib/pricing.ts');
  const estKnown = pricingMod.estimateCost('deepseek-flash', {
    inputTokens: 1000000,
    outputTokens: 1000000,
  });
  check('价格：已知模型给出估算', estKnown.kind === 'estimated' && estKnown.usd > 0);
  check(
    '价格：未知模型不猜价格',
    pricingMod.estimateCost('unknown-model-xyz', { inputTokens: 1000 }).kind === 'unavailable',
  );
  check(
    '价格：本地模型算免费',
    pricingMod.estimateCost('deepseek-flash', {}, { isLocal: true }).kind === 'free',
  );
  check(
    '价格：自定义价格优先',
    pricingMod.estimateCost(
      'my-model',
      { inputTokens: 1000000, outputTokens: 0 },
      { customPrices: { 'my-model': { input: 1, output: 2 } } },
    ).usd === 1,
  );
  check(
    '价格：缓存命中不重复计费',
    pricingMod.estimateCost('deepseek-flash', {
      inputTokens: 1000000,
      cachedInputTokens: 1000000,
      outputTokens: 0,
    }).usd < 0.28,
  );

  // --- 用量归一化（V0.6.14）---
  const aiUsageMod = await server.ssrLoadModule('/src/lib/ai/usage.ts');
  const u1 = aiUsageMod.normalizeUsage({
    providerId: 'deepseek',
    provider: 'DeepSeek',
    model: 'deepseek-flash',
    raw: { promptTokens: 1000, completionTokens: 500, cachedTokens: 200, reasoningTokens: 100 },
    latencyMs: 1200,
  });
  check(
    '用量：token 字段归一化',
    u1.inputTokens === 1000 && u1.outputTokens === 500 && u1.cachedInputTokens === 200,
  );
  check('用量：合计自动补算', u1.totalTokens === 1500);
  check('用量：给出估算费用', u1.costKind === 'estimated' && typeof u1.costUsd === 'number');
  check('用量：保留延迟', u1.latencyMs === 1200);

  const u2 = aiUsageMod.normalizeUsage({
    providerId: 'mock',
    provider: '离线演示',
    model: 'mock',
    raw: {},
    isLocal: true,
  });
  check('用量：离线演示标记免费', u2.costKind === 'free' && u2.costUsd === 0);

  const u3 = aiUsageMod.normalizeUsage({
    providerId: 'custom',
    provider: '自建',
    model: 'whatever',
    raw: { promptTokens: 10, completionTokens: 5 },
  });
  check(
    '用量：未知价格标记 unavailable',
    u3.costKind === 'unavailable' && u3.costUsd === undefined,
  );
  check(
    '用量：token 格式化',
    aiUsageMod.formatTokens(2800) === '2.8K' &&
      aiUsageMod.formatTokens(150) === '150' &&
      aiUsageMod.formatTokens(2500000) === '2.50M',
  );
  check(
    '用量：费用区分估算 / 未知 / 免费',
    aiUsageMod.formatCost({ costKind: 'estimated', costUsd: 0.007 }) === '≈$0.0070' &&
      aiUsageMod.formatCost({ costKind: 'unavailable' }) === '价格未知' &&
      aiUsageMod.formatCost({ costKind: 'free', costUsd: 0 }) === '免费',
  );

  const totals = aiUsageMod.sumUsage([{ usage: u1 }, { usage: u3 }]);
  check('用量：会话累加调用数', totals.calls === 2);
  check('用量：会话累加 token', totals.totalTokens === 1515);
  check('用量：未知价格会让总额成为下界', totals.hasUnpriced === true);
  check('用量：会话摘要文案', aiUsageMod.formatTotalsSummary(totals).includes('≥$'));

  // --- 项目 id 必须是 UUID（修复「同步报 invalid input syntax for type uuid」）---
  const idMod = await server.ssrLoadModule('/src/lib/id.ts');
  const uuidSample = idMod.newUuid();
  check('id：newUuid 生成标准 UUID', idMod.isUuid(uuidSample));
  check('id：uid("p_") 不是 UUID', !idMod.isUuid(idMod.uid('p_')));

  // 新建项目必须产出 UUID，否则云端 uuid 列会拒绝（回归测试）
  const createdProjectId = storeMod.useStore.getState().createProject('uuid-check');
  check('id：新建项目的 id 是 UUID', idMod.isUuid(createdProjectId));

  const legacyProjectId = 'p_mu58jl93f87223cb';
  const fixedIds = storageMod.ensureUuidProjectIds(
    [{ id: legacyProjectId, title: '复变函数', summary: '', createdAt: 0, updatedAt: 0 }],
    [t('n1', null, { projectId: legacyProjectId })],
    [{ id: 'e1', projectId: legacyProjectId, source: 'a', target: 'b', type: 'branch', createdAt: 0 }],
    legacyProjectId,
  );
  check('id 迁移：项目 id 换成 UUID', idMod.isUuid(fixedIds.projects[0].id));
  check('id 迁移：节点 projectId 跟着换', fixedIds.nodes[0].projectId === fixedIds.projects[0].id);
  check('id 迁移：连线 projectId 跟着换', fixedIds.edges[0].projectId === fixedIds.projects[0].id);
  check('id 迁移：activeProjectId 跟着换', fixedIds.activeProjectId === fixedIds.projects[0].id);
  check(
    'id 迁移：已同步过的 UUID 项目不动',
    storageMod.ensureUuidProjectIds(
      [
        {
          id: uuidSample,
          title: 'x',
          summary: '',
          createdAt: 0,
          updatedAt: 0,
          cloudUpdatedAt: 1,
        },
      ],
      [],
      [],
      uuidSample,
    ).projects[0].id === uuidSample,
  );

  // --- 设置归一化（修复「点开卡片白屏」：云端旧设置缺少 behavior 字段）---
  const normalizedOld = storageMod.normalizeSettings({ theme: 'dark' });
  check(
    '设置归一：补齐缺失的 behavior',
    Boolean(normalizedOld.behavior && Array.isArray(normalizedOld.behavior.profiles)),
  );
  check('设置归一：保留旧值', normalizedOld.theme === 'dark');
  check(
    '设置归一：空设置也安全',
    Array.isArray(storageMod.normalizeSettings(undefined).behavior.profiles),
  );
  check('行为：profiles 缺失时不崩', behaviorMod.findBehavior(undefined, 'explorer').id === 'explorer');
  check('行为：profiles 为空时不崩', behaviorMod.findBehavior([], undefined).id === 'default');

  // --- V0.7.0 Cost Foundation ---
  const policyMod = await server.ssrLoadModule('/src/lib/ai/policy.ts');
  check('策略：指纹稳定', policyMod.fingerprint('abc') === policyMod.fingerprint('abc'));
  check('策略：指纹会变', policyMod.fingerprint('abc') !== policyMod.fingerprint('abd'));
  check('策略：寒暄不推理', policyMod.planReasoning('你好').level === 'none');
  check(
    '策略：难题用强推理',
    ['high', 'max'].includes(
      policyMod.planReasoning('请推导这个算法的复杂度并证明其正确性，详细说明每一步').level,
    ),
  );
  check(
    '策略：普通问题轻推理',
    policyMod.planReasoning('注意力机制是怎么工作的，能说说吗').level === 'low',
  );
  check('策略：要求简短→紧凑', policyMod.planOutput('简单说一下', 'low').budget === 'compact');
  check('策略：要求详细→深入', policyMod.planOutput('请详细展开讲解', 'high').budget === 'deep');

  const planOn = policyMod.planRequest({
    question: '你好',
    stableText: 'sys',
    stableChars: 3,
    dynamicChars: 1,
    runtime: { stablePrefix: true, adaptiveReasoning: true, adaptiveOutput: true },
  });
  check(
    '策略：planRequest 产出完整决策',
    planOn.reasoning === 'none' && planOn.prefixFingerprint.length === 8 && planOn.maxOutputTokens > 0,
  );
  const planOff = policyMod.planRequest({
    question: '请证明',
    stableText: 'sys',
    stableChars: 3,
    dynamicChars: 1,
    runtime: { stablePrefix: true, adaptiveReasoning: false, adaptiveOutput: false },
    manualThinking: { enabled: true, effort: 'high' },
  });
  check(
    '策略：关闭自适应后按手动设置',
    planOff.reasoning === 'high' && planOff.maxOutputTokens === undefined,
  );

  const costCached = pricingMod.estimateCost('deepseek-flash', {
    inputTokens: 1000000,
    cachedInputTokens: 800000,
    outputTokens: 0,
  });
  check(
    '价格：拆分 input / cached',
    costCached.inputCost > 0 && costCached.cachedInputCost > 0,
  );
  check('价格：给出无缓存基准价', costCached.baselineInputCost === 0.28);
  check(
    '价格：缓存节省 = 基准 − 实际',
    Math.abs(
      costCached.cacheSavingsUsd -
        (costCached.baselineInputCost - costCached.inputCost - costCached.cachedInputCost),
    ) < 1e-12,
  );

  const uCached = aiUsageMod.normalizeUsage({
    providerId: 'deepseek',
    provider: 'DeepSeek',
    model: 'deepseek-flash',
    raw: { promptTokens: 1000, completionTokens: 100, cachedTokens: 800 },
  });
  check('用量：未命中 = 输入 − 命中', uCached.uncachedInputTokens === 200);
  check('用量：缓存命中率', Math.abs(uCached.cacheHitRate - 0.8) < 1e-9);
  check('用量：优化率可计算', aiUsageMod.optimizationRate(uCached) > 0);
  check('用量：币种固定 USD', uCached.currency === 'USD');

  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
  console.log(`\nAPP_HTML_LEN=${html.length}  MD_HTML_LEN=${mdHtml.length}`);
} catch (err) {
  console.error('RENDER_FAIL');
  console.error(err);
  failed = true;
} finally {
  await server.close();
}

console.log(failed ? '\n冒烟测试失败' : '\n冒烟测试通过');
process.exit(failed ? 1 : 0);
