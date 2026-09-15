/**
 * 云端联调检查：用真实 Supabase 跑一遍「登录 → 推送 → 拉取 → 增量推送」。
 *
 * 需要环境变量（不写进代码）：
 *   TS_TEST_EMAIL / TS_TEST_PASSWORD
 * 未提供时自动跳过，因此可以安全地放进仓库。
 */
import { createServer } from 'vite';

const email = process.env.TS_TEST_EMAIL;
const password = process.env.TS_TEST_PASSWORD;

if (!email || !password) {
  console.log('跳过云端联调：未提供 TS_TEST_EMAIL / TS_TEST_PASSWORD');
  process.exit(0);
}

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const server = await createServer({
  root: process.cwd(),
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

let failed = false;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
};

const PROJECT_ID = '99999999-9999-9999-9999-999999999999';
const empty = (settings) => ({
  projects: [],
  nodes: [],
  edges: [],
  messages: [],
  settings,
});

try {
  const clientMod = await server.ssrLoadModule('/src/lib/cloud/client.ts');
  if (!clientMod.cloudConfigured) {
    console.log('跳过云端联调：Supabase 未配置');
    await server.close();
    process.exit(0);
  }

  const authMod = await server.ssrLoadModule('/src/lib/cloud/auth.ts');
  const engineMod = await server.ssrLoadModule('/src/lib/cloud/engine.ts');
  const syncMod = await server.ssrLoadModule('/src/lib/cloud/sync.ts');
  const storageMod = await server.ssrLoadModule('/src/lib/storage.ts');
  const settings = storageMod.DEFAULT_SETTINGS;

  const user = await authMod.signInWithPassword(email, password);
  check('登录成功', Boolean(user?.id));

  // 清理：删掉这个账号下的历史数据，保证测试从干净状态开始
  engineMod.resetCloudEngine(user.id);
  const existing = await syncMod.pullAll();
  if (existing && existing.projects.length > 0) {
    await syncMod.deleteRemoteProjects(existing.projects.map((p) => p.id));
  }
  engineMod.resetCloudEngine(user.id);

  const now = Date.now();
  const snapshot = {
    projects: [
      {
        id: PROJECT_ID,
        title: 'cloud-check',
        summary: 'automated check',
        createdAt: now,
        updatedAt: now,
      },
    ],
    nodes: [
      {
        id: 'node-1',
        projectId: PROJECT_ID,
        parentId: null,
        title: 'test topic',
        summary: 'summary',
        position: { x: 0, y: 0 },
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    edges: [],
    messages: [
      { id: 'msg-1', nodeId: 'node-1', role: 'user', content: 'hello', createdAt: now },
      { id: 'msg-2', nodeId: 'node-1', role: 'assistant', content: 'world', createdAt: now },
    ],
    settings,
  };

  const first = await engineMod.fullSync(snapshot);
  check('首次同步把本地项目上传到云端', first.pushedCount === 1);
  check('首次同步没有报错', first.warnings.length === 0);

  engineMod.resetCloudEngine(user.id);
  const second = await engineMod.fullSync(empty(settings));
  check('从空本地能拉回云端项目', second.snapshot.projects.length === 1);
  check('拉回的节点正确', second.snapshot.nodes.length === 1);
  check('拉回的对话正确', second.snapshot.messages.length === 2);
  check('拉回的项目标题正确', second.snapshot.projects[0]?.title === 'cloud-check');
  check(
    '拉回的节点挂在正确项目下',
    second.snapshot.nodes[0]?.projectId === PROJECT_ID,
  );

  // 增量推送：模拟改了标题
  engineMod.resetCloudEngine(user.id);
  await engineMod.fullSync(snapshot);
  const edited = {
    ...snapshot,
    projects: [{ ...snapshot.projects[0], title: 'cloud-check-edited', updatedAt: Date.now() }],
  };
  const pushed = await engineMod.pushDirty(edited);
  check('增量推送能识别改动', pushed.pushed === 1);

  engineMod.resetCloudEngine(user.id);
  const verify = await engineMod.fullSync(empty(settings));
  check('改动已保存到云端', verify.snapshot.projects[0]?.title === 'cloud-check-edited');

  // 收尾清理
  await syncMod.deleteRemoteProjects([PROJECT_ID]);
} catch (err) {
  console.error('云端联调异常：', err?.message ?? err);
  failed = true;
} finally {
  await server.close();
}

console.log(failed ? '\n云端联调失败' : '\n云端联调通过');
process.exit(failed ? 1 : 0);
