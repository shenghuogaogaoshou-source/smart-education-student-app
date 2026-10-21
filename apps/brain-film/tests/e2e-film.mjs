/* 首映礼 · 逐格拍片流程 · 真浏览器回归测试
   用法:先起前端(node_modules 已装就在项目根跑 启动游戏.cmd 或 npm run dev),再
        node tests/e2e-film.mjs
   它会把 AI 接口全换成假的(window.fetch 拦 /api/*),所以不花一分钱、不用联网,
   只验前端流程:每格各提交一次、提示词带这一格的剧本句、按顺序拼接、
   某格失败要降级成静帧、再点一次不重复买已经拍好的段。 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.BH_APP_URL || 'http://127.0.0.1:5174/';
const PORT = Number(process.env.BH_CDP_PORT || 9334);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + String(extra).slice(0, 160) : ''));
}

/* 在页面脚本之前装好假接口:不连后端、不花钱 */
const MOCK = `(() => {
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  const mock = window.__mock = { submits: [], stitches: [], failCaption: '' };
  const STORY_LINES = [
    '会发光的小蘑菇精住在云朵上的图书馆,它想出门去看看',
    '它把海浪当成电梯,一路滚到海底的理发店',
    '理发师忘了自己的名字,小蘑菇精帮它想了起来',
    '最后大家在海边唱歌跳舞,把快乐分给了每一条鱼',
  ];
  const json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const bodyOf = init => { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } };
  window.confirm = () => true;
  window.prompt = () => '宝物';
  window.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : (input && input.url) || '');
    const path = url.replace(/^https?:\\/\\/[^/]+/, '');
    if (path === '/api/config') {
      return json({ ok: true, backend: true, ai: true, version: 'test', netwhy: {},
        modules: {
          story: { ready: true, reach: true, model: 'glm-test' },
          polish: { ready: true, reach: true, model: 'glm-test' },
          synopsis: { ready: true, reach: true, model: 'glm-test' },
          image: { ready: false, reach: true, model: 'seedream-offline' },
          video: { ready: true, reach: true, model: 'doubao-seedance-test', net: 'ark.test' },
          tts: { ready: true, reach: true, model: 'glm-tts' },
        },
        limits: { images: 12, voiceChars: 300, videosPerDay: 0, videoUnlimited: true, videosToday: 7, maxFilmSegments: 10 } });
    }
    if (path === '/api/story') return json({ ok: true, lines: STORY_LINES });
    if (path === '/api/video') {
      const b = bodyOf(init);
      mock.submits.push(b);
      const fails = !!mock.failCaption && String(b.prompt || '').indexOf('这一格演的是:' + mock.failCaption) >= 0;
      return json({ ok: true, taskId: (fails ? 'fail-' : 'task-') + mock.submits.length, model: 'doubao-seedance-test', dayUsed: 7, dayLimit: 0 });
    }
    if (path.indexOf('/api/video/') === 0) {
      const id = path.slice('/api/video/'.length);
      if (id.indexOf('fail-') === 0) return json({ ok: true, status: 'failed', error: { message: '这一格模型抽风了' } });
      return json({ ok: true, status: 'succeeded', videoUrl: 'https://cdn.test/' + id + '.mp4', model: 'doubao-seedance-test', cost: 0.05 });
    }
    if (path === '/api/film/stitch') {
      const b = bodyOf(init);
      mock.stitches.push(b);
      return json({ ok: true, url: '/api/films/fake-' + mock.stitches.length + '.mp4', bytes: 98765,
        segments: (b.segments || []).length, seconds: (b.segments || []).length * 5, voiceChars: 200, id: 'fake' });
    }
    if (realFetch) return realFetch(input, init);
    throw new Error('没有 mock 这个请求:' + path);
  };
})();`;

class CDP {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.errors = []; }
  async ready() {
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', () => rej(new Error('连不上无头浏览器')), { once: true });
    });
    this.ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

async function pageTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(150);
  }
  throw new Error('无头浏览器没起来,检查 Edge/Chrome 是否安装');
}

const browserPath = BROWSERS.find(p => p && existsSync(p));
if (!browserPath) { console.error('找不到 Edge 或 Chrome'); process.exit(1); }

const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'bh-film-'));
const proc = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=430,900', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let cdp;
try {
  cdp = new CDP(await pageTarget());
  await cdp.ready();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK });

  const js = async expr => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面脚本出错:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, timeout = 15000, label = expr) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await js(expr)) return true; } catch { /* 还没准备好 */ }
      await sleep(150);
    }
    throw new Error('等超时:' + label);
  };
  const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);

  await cdp.send('Page.navigate', { url: APP });
  await waitFor(`!!document.querySelector('#btn-newfilm')`, 20000, '欢迎页');

  console.log('\n== 1. 走到首映礼 ==');
  await click('#btn-newfilm');
  await waitFor(`!!document.querySelector('#slot-grid .slotcard')`);
  await click('#btn-drawall');
  await sleep(200);
  await click('#btn-card2idea');
  await waitFor(`!!document.querySelector('#sc-idea.active')`, 15000, '讲想法页');
  await click('#btn-idea2story');
  await waitFor(`!!document.querySelector('#sc-story.active')`, 15000, '写剧本页');
  await sleep(300);
  await click('#btn-story2style');
  await waitFor(`!!document.querySelector('#sc-style.active')`, 15000, '定画风页');
  await js(`(() => { const i = document.querySelector('#in-style-custom'); i.value = '水彩绘本'; return true; })()`);
  await click('#btn-style-custom');
  await sleep(200);
  await click('#btn-style2board');
  await waitFor(`!!document.querySelector('#panel-grid .panel')`);
  const captions = await js(`Array.from(document.querySelectorAll('#panel-grid .panel textarea.cap')).map(t => t.value.trim())`);
  check('分镜页有剧本分出来的格子', captions.length > 0, captions.join(' / '));
  await click('#btn-board2prem');
  await waitFor(`!!document.querySelector('#btn-film-ai')`);
  await sleep(200);

  console.log('\n== 2. 每格各拍一段(第 3 格故意失败,验降级)==');
  await js(`window.__mock.failCaption = ${JSON.stringify(captions[2] || '__none__')}`);
  await click('#btn-film-ai');
  await waitFor(`window.__mock.stitches.length >= 1`, 180000, '第一次拼接完成');

  const run1 = await js(`({
    submits: window.__mock.submits,
    stitch: window.__mock.stitches[0],
    msg: (document.querySelector('#film-msg') || {}).textContent || '',
    player: !!document.querySelector('#film-player video'),
    src: (document.querySelector('#film-player video') || {}).src || '',
  })`);

  check('每一格都提交了一次视频任务', run1.submits.length >= captions.length, run1.submits.length + ' 次 / ' + captions.length + ' 格');
  const prompts = run1.submits.map(s => String(s.prompt || ''));
  const promptOf = cap => prompts.find(p => p.includes('这一格演的是:' + cap)) || '';
  check('每格的提示词带的是这一格自己的剧本句',
    captions.every(cap => promptOf(cap).includes(cap)),
    captions.map(cap => promptOf(cap).slice(0, 16)).join(' | '));
  check('第 2 格起会承接上一格',
    captions.slice(1).every((cap, i) => promptOf(cap).includes('上一格是「' + captions[i] + '」')),
    promptOf(captions[1] || '').slice(-40));
  check('提示词各不相同(不是同一句话复制 N 遍)', new Set(prompts).size === captions.length, new Set(prompts).size + ' 种');
  check('每格都带了首帧画面', run1.submits.every(s => String(s.image || '').startsWith('data:image/')));
  check('每段都要 5 秒镜头', run1.submits.every(s => Number(s.duration) === 5));

  const stitch1 = run1.stitch || {};
  const segs1 = stitch1.segments || [];
  check('拼接口收到全部镜头', segs1.length === captions.length, segs1.length + ' 段');
  check('拼接顺序和剧本一致', segs1.every((s, i) => s.line === captions[i]), segs1.map(s => (s.line || '').slice(0, 8)).join(' / '));
  check('拍成的段交给服务端当视频', segs1.filter(s => s.videoUrl).length === captions.length - 1, segs1.filter(s => s.videoUrl).length + ' 段有视频');
  check('没拍成的那一格降级成静帧图', !!segs1[2] && !segs1[2].videoUrl && String(segs1[2].image || '').startsWith('data:image/'));
  check('页面上说清楚有几格用了静帧', /静帧|顶上/.test(run1.msg), run1.msg.slice(0, 80));
  check('成片进了播放器', run1.player && run1.src.includes('/api/films/'), run1.src);

  console.log('\n== 3. 再点一次:只补缺的那一格,不重复买 ==');
  await js(`window.__mock.failCaption = ''`);
  const submitsBefore = await js(`window.__mock.submits.length`);
  await click('#btn-film-ai');
  await waitFor(`window.__mock.stitches.length >= 2`, 180000, '第二次拼接完成');
  const after = await js(`({
    submits: window.__mock.submits.length,
    stitch: window.__mock.stitches[1],
    msg: (document.querySelector('#film-msg') || {}).textContent || '',
  })`);

  check('只补拍了缺的那一格', after.submits - submitsBefore === 1, '新增 ' + (after.submits - submitsBefore) + ' 次');
  const segs2 = (after.stitch || {}).segments || [];
  check('这次全部是 AI 镜头', segs2.length === captions.length && segs2.every(s => s.videoUrl && !s.image));
  check('顺序依然和剧本一致', segs2.every((s, i) => s.line === captions[i]));
  check('页面提示成片已好', /✅/.test(after.msg), after.msg.slice(0, 80));

  console.log('\n== 4. 刷新页面回到首映礼,按钮还要能用 ==');
  await cdp.send('Page.reload');
  await waitFor(`!!document.querySelector('#btn-film-ai')`, 20000, '刷新后首映礼');
  await sleep(800);
  const rehook = await js(`(() => ({
    wired: typeof (document.querySelector('#btn-film-ai') || {}).onclick === 'function',
    screen: (document.querySelector('.screen.active') || {}).id || '',
  }))()`);
  check('草稿恢复到首映礼时按钮仍然挂着事件', rehook.wired, '当前屏:' + rehook.screen);

  console.log('\n== 5. 页面没有报错 ==');
  check('控制台没有 JS 错误', cdp.errors.length === 0, cdp.errors.join(' | '));

  const failed = results.filter(r => !r.ok);
  console.log(`\n结果:${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) { console.log('失败项:' + failed.map(f => f.name).join(', ')); process.exitCode = 1; }
} catch (err) {
  console.error('\n测试跑不下去:' + err.message);
  process.exitCode = 1;
} finally {
  try { cdp?.ws.close(); } catch { /* ignore */ }
  proc.kill();
  await sleep(600);
  try { rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch { /* 文件还占着就算了 */ }
}
