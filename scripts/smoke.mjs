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

try {
  const appMod = await server.ssrLoadModule('/src/App.tsx');
  const App = appMod.default;
  const html = renderToString(React.createElement(App));

  const checks = [
    ['品牌名 ThinkingSpace', html.includes('ThinkingSpace')],
    ['地图容器', html.includes('react-flow')],
    ['侧边栏项目概述', html.includes('项目概述')],
    ['示例主题卡', html.includes('Transformer')],
  ];

  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed = true;
  }
  console.log(`\n渲染输出长度：${html.length}`);
} catch (err) {
  console.error('RENDER_FAIL');
  console.error(err);
  failed = true;
} finally {
  await server.close();
}

console.log(failed ? '\n冒烟测试失败' : '\n冒烟测试通过');
process.exit(failed ? 1 : 0);
