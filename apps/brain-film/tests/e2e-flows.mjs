/* 全流程回归:这一轮修掉的那些坑,逐条用真浏览器验一遍
   用法:先起前端(启动游戏.cmd 或 npm run dev),再 node tests/e2e-flows.mjs
   做法:在页面脚本之前塞一份草稿,然后依次验:
     清"我加的卡"不动台面 / 全部重画要清掉 AI 图 / 加一格不会离开就被抹掉 /
     重复选同一画风不清空分镜 / 打印大纲的类名和 CSS 对得上 /
     改卡片后剧本"变旧"提示会出现 / 手改剧本保存后刷新不丢 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.BH_APP_URL || 'http://127.0.0.1:5174/';
const PORT = Number(process.env.BH_CDP_PORT || 9341);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const SVG = '<svg viewBox="0 0 16 10" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="10" fill="#dde"/></svg>';
const STORY = '第一句剧本\n第二句剧本\n第三句剧本';

const DRAFT = {
  v: 3, stage: 'board', director: '测试导演', intern: '小映', style: '蜡笔涂鸦',
  title: '流程测试', idea: '我的想法', story: STORY, storyDraft: STORY,
  slots: [
    { key: 'hero', name: '主角', emoji: '🦸', required: true, pool: [{ t: '五个同伴', e: '🦸' }], card: { t: '五个同伴', e: '🦸' } },
    { key: 'scene', name: '场景', emoji: '🏞️', required: true, pool: [], card: { t: '实验室', e: '🏞️' } },
    { key: 'plot', name: '经过', emoji: '➡️', required: true, pool: [], card: { t: '做个项目', e: '➡️' } },
    { key: 'custom1', name: '宝物', emoji: '🧩', custom: true, required: false, pool: [{ t: '会飞的雨伞', e: '🧩', mine: true }], card: { t: '会飞的雨伞', e: '🧩' } },
  ],
  panelsFrom: STORY,
  panels: [
    { cap: '第一句剧本', prm: '提示词一', svg: SVG, img: PNG, version: 2, accepted: true },
    { cap: '第二句剧本', prm: '提示词二', svg: SVG, img: PNG, version: 2, accepted: true },
    { cap: '第三句剧本', prm: '提示词三', svg: SVG, img: '', version: 1, accepted: false },
  ],
  refl: ['', ''], statement: '', log: [], filmIdx: 0, filmMs: 0, filmSeconds: 0,
  videoUrl: '', videoModel: '', videoCost: 0, videoSegments: {}, aiShots: 2,
};

const SEED = `(() => {
  try {
    /* 只在第一次(还没有草稿)时播种,刷新后不能再覆盖用户刚存下的草稿 */
    if (!localStorage.getItem('bh_draft')) {
      localStorage.setItem('bh_draft', ${JSON.stringify(JSON.stringify(DRAFT))});
    }
  } catch (e) {}
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.confirm = () => true;
  window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  window.fetch = async (input, init) => {
    const path = String(typeof input === 'string' ? input : (input && input.url) || '').replace(/^https?:\\/\\/[^/]+/, '');
    if (path === '/api/config') {
      return new Response(JSON.stringify({ ok: true, backend: true, ai: false, version: 'test',
        modules: { story: { ready: false }, polish: { ready: false }, synopsis: { ready: false },
                   image: { ready: false }, video: { ready: false }, tts: { ready: false } },
        limits: { images: 12, voiceChars: 300, videosPerDay: 0, videoUnlimited: true, videosToday: 0, maxFilmSegments: 10 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (realFetch) return realFetch(input, init);
    throw new Error('没有 mock:' + path);
  };
})();`;

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + String(extra).slice(0, 150) : ''));
}

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
  throw new Error('无头浏览器没起来');
}

const browserPath = BROWSERS.find(p => p && existsSync(p));
if (!browserPath) { console.error('找不到 Edge 或 Chrome'); process.exit(1); }

const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'bh-flows-'));
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
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });

  const js = async expr => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面脚本出错:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, timeout = 20000, label = expr) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await js(expr)) return true; } catch { /* 还没好 */ }
      await sleep(150);
    }
    throw new Error('等超时:' + label);
  };
  const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
  const setInput = (sel, v) => js(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    el.value = ${JSON.stringify(v)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

  await cdp.send('Page.navigate', { url: APP });
  await waitFor(`!!document.querySelector('#panel-grid .panel')`, 25000, '画分镜页');

  console.log('\n== 1. 清「我加的卡」不许动台面 ==');
  await click('.step[data-step="1"]');
  await waitFor(`!!document.querySelector('#slot-grid .slotcard')`);
  const slotsBefore = await js(`({
    count: document.querySelectorAll('#slot-grid .slotcard').length,
    hero: (document.querySelectorAll('#slot-grid .slotcard')[0].querySelector('.slot-card b') || {}).textContent || '',
    custom: Array.from(document.querySelectorAll('#slot-grid .slot-name')).some(n => n.textContent.includes('宝物')),
  })`);
  await click('#btn-settings');
  await sleep(200);
  await click('#btn-clear-mine');
  await sleep(400);
  const slotsAfter = await js(`({
    count: document.querySelectorAll('#slot-grid .slotcard').length,
    hero: (document.querySelectorAll('#slot-grid .slotcard')[0].querySelector('.slot-card b') || {}).textContent || '',
    custom: Array.from(document.querySelectorAll('#slot-grid .slot-name')).some(n => n.textContent.includes('宝物')),
    msg: (document.querySelector('#data-msg') || {}).textContent || '',
  })`);
  check('格子数量没被冲掉', slotsAfter.count === slotsBefore.count, slotsBefore.count + ' → ' + slotsAfter.count);
  check('已经抽好的卡还在', slotsAfter.hero === slotsBefore.hero && !!slotsAfter.hero, slotsAfter.hero);
  check('自己加的格子还在', slotsAfter.custom);
  check('提示里说清了清了几张', /清掉|没有往卡池/.test(slotsAfter.msg), slotsAfter.msg);
  await click('#btn-settings-close');

  console.log('\n== 2. 「全部重画」要真的换回程序画师 ==');
  await click('.step[data-step="5"]');
  await waitFor(`!!document.querySelector('#panel-grid .panel')`);
  const artBefore = await js(`({
    img: document.querySelectorAll('#panel-grid .panel .svgbox img').length,
    svg: document.querySelectorAll('#panel-grid .panel .svgbox svg').length,
  })`);
  await click('#btn-paintall');
  await sleep(400);
  const artAfter = await js(`({
    img: document.querySelectorAll('#panel-grid .panel .svgbox img').length,
    svg: document.querySelectorAll('#panel-grid .panel .svgbox svg').length,
  })`);
  check('重画前有 AI 图', artBefore.img >= 1, 'AI 图 ' + artBefore.img + ' 张');
  check('全部重画后 AI 图被换掉', artAfter.img === 0, 'AI 图 ' + artAfter.img + ' 张');
  check('全部重画后每格都有程序插画', artAfter.svg === 3, '插画 ' + artAfter.svg + ' 张');

  console.log('\n== 3. 加一格:离开再回来不能被抹掉 ==');
  const panelsBefore = await js(`document.querySelectorAll('#panel-grid .panel').length`);
  await click('#btn-addpanel');
  await sleep(300);
  const panelsAdded = await js(`document.querySelectorAll('#panel-grid .panel').length`);
  await click('#btn-board2prem');
  await sleep(500);
  await click('.step[data-step="5"]');
  await sleep(600);
  const panelsBack = await js(`document.querySelectorAll('#panel-grid .panel').length`);
  check('加一格生效', panelsAdded === panelsBefore + 1, panelsBefore + ' → ' + panelsAdded);
  check('去首映礼再回来,加的那格还在', panelsBack === panelsAdded, '回来后有 ' + panelsBack + ' 格');

  console.log('\n== 4. 重重点同一个画风,不能把分镜清空 ==');
  const pagesBefore = await js(`(() => { document.querySelector('.step[data-step="6"]').click(); return 0; })()`);
  await sleep(500);
  const filmsBefore = await js(`document.querySelectorAll('#film .page').length`);
  await click('.step[data-step="4"]');
  await sleep(400);
  await setInput('#in-style-custom', '蜡笔涂鸦');
  await click('#btn-style-custom');
  await sleep(400);
  await click('.step[data-step="6"]');
  await sleep(500);
  const filmsAfter = await js(`document.querySelectorAll('#film .page').length`);
  check('重选同一画风后分镜页数不变', filmsAfter === filmsBefore, filmsBefore + ' → ' + filmsAfter);

  console.log('\n== 5. 打印大纲的类名和 CSS 对得上 ==');
  await js(`(() => { const t = document.querySelector('#in-title'); if (t) t.value = '流程测试'; return true; })()`);
  await click('#btn-print');
  await sleep(800);
  const printInfo = await js(`(() => {
    const css = Array.from(document.styleSheets).flatMap(s => { try { return Array.from(s.cssRules).map(r => r.cssText); } catch (e) { return []; } }).join(' ');
    const sheets = document.querySelectorAll('#printRoot .print-sheet').length;
    const subs = document.querySelectorAll('#printRoot .print-sub').length;
    const printed = window.__printed || 0;
    return { sheets, subs, printed, hasRule: css.includes('.print-sheet'), hasSubRule: css.includes('.print-sub'), title: (document.querySelector('#printRoot .print-title') || {}).textContent || '' };
  })()`);
  check('打印大纲按"每格一页"渲染', printInfo.sheets === filmsAfter - 1, printInfo.sheets + ' 页(分镜 ' + (filmsAfter - 1) + ')');
  check('CSS 里真的有 .print-sheet 规则(以前类名对不上)', printInfo.hasRule);
  check('.print-sub 也有样式了', printInfo.hasSubRule && printInfo.subs > 0, printInfo.subs + ' 处');
  check('确实调用了打印', printInfo.printed >= 1, 'print() 调用 ' + printInfo.printed + ' 次');
  check('标题进了大纲', /流程测试/.test(printInfo.title), printInfo.title);

  console.log('\n== 6. 改了卡片,剧本"变旧"的提示要出现 ==');
  await click('.step[data-step="1"]');
  await waitFor(`!!document.querySelector('#slot-grid .slotcard')`);
  await js(`(() => { const b = document.querySelector('#slot-grid .slotcard [data-act="draw"]'); b.click(); return true; })()`);
  await sleep(300);
  await click('.step[data-step="3"]');
  await sleep(500);
  const stale = await js(`(() => { const el = document.querySelector('#stale-story');
    return { visible: el && !el.classList.contains('hidden'), text: (el || {}).textContent || '' }; })()`);
  check('改卡片后提示"剧本还是旧的"', stale.visible && /旧/.test(stale.text), stale.text.slice(0, 60));

  console.log('\n== 7. 手改剧本保存后,刷新不能丢 ==');
  const NEW_STORY = '改过的第一句\n改过的第二句';
  await setInput('#ta-story', NEW_STORY);
  await click('#btn-story-save');
  await sleep(600);
  await cdp.send('Page.reload');
  await waitFor(`!!document.querySelector('#ta-story')`, 25000, '刷新后写剧本页');
  await sleep(800);
  const afterReload = await js(`({
    story: (document.querySelector('#ta-story') || {}).value || '',
    stale: (() => { const el = document.querySelector('#stale-story'); return el ? !el.classList.contains('hidden') : false; })(),
  })`);
  check('刷新后剧本还是我改的版本', afterReload.story.trim() === NEW_STORY, JSON.stringify(afterReload.story.slice(0, 40)));
  check('保存新剧本后"变旧"提示消失', afterReload.stale === false);

  console.log('\n== 8. 页面没有报错 ==');
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
