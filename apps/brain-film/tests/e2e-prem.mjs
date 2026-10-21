/* 首映礼 · 「翻页看每一页分镜」回归测试
   用法:先起前端(启动游戏.cmd 或 npm run dev),再
        node tests/e2e-prem.mjs
   做法:在页面脚本之前往 localStorage 放一份草稿(直接停在首映礼),
        其中一格有 AI 图、一格只有程序化插画、一格什么都没有,
        然后验证这一块的展示、翻页、缩略图、自动翻页、下载名。 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.BH_APP_URL || 'http://127.0.0.1:5174/';
const PORT = Number(process.env.BH_CDP_PORT || 9338);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const SVG = '<svg viewBox="0 0 16 10" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="10" fill="#ccddee"/></svg>';

const DRAFT = {
  v: 3, stage: 'prem', director: '测试导演', intern: '小映',
  style: '蜡笔涂鸦', title: '翻页测试', idea: '想法', story: '第一句\n第二句\n第三句\n第四句',
  slots: [
    { key: 'hero', name: '主角', emoji: '🦸', required: true, pool: [], card: { t: '五个同伴', e: '🦸' } },
    { key: 'scene', name: '场景', emoji: '🏞️', required: true, pool: [], card: { t: '实验室', e: '🏞️' } },
  ],
  panels: [
    { cap: '第 1 页:有 AI 图', prm: '提示词一', svg: '', img: PNG },
    { cap: '第 2 页:只有程序化插画', prm: '提示词二', svg: SVG, img: '' },
    { cap: '第 3 页:什么都没有', prm: '', svg: '', img: '' },
    { cap: '第 4 页:也有 AI 图', prm: '提示词四', svg: SVG, img: PNG },
  ],
  refl: ['', ''], statement: '', log: [{ t: '22:00', kind: 'video', txt: '测试日志' }],
  filmIdx: 0, filmMs: 120000, filmSeconds: 45,
  videoUrl: '/api/films/test-film.mp4', videoModel: '测试模型', videoCost: 0.4, videoSegments: {},
  wrongOn: false,
};

const SEED = `(() => {
  try {
    localStorage.setItem('bh_draft', ${JSON.stringify(JSON.stringify(DRAFT))});
    localStorage.setItem('bh_profile', JSON.stringify({ director: '测试导演' }));
  } catch (e) {}
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.confirm = () => true;
  window.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : (input && input.url) || '');
    const path = url.replace(/^https?:\\/\\/[^/]+/, '');
    if (path === '/api/config') {
      return new Response(JSON.stringify({ ok: true, backend: true, ai: false, version: 'test',
        modules: { story: { ready: false }, polish: { ready: false }, synopsis: { ready: false },
                   image: { ready: false }, video: { ready: false }, tts: { ready: false } },
        limits: { images: 12, voiceChars: 300, videosPerDay: 0, videoUnlimited: true, videosToday: 0, maxFilmSegments: 10 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (realFetch) return realFetch(input, init);
    throw new Error('没有 mock 这个请求:' + path);
  };
})();`;

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + String(extra).slice(0, 160) : ''));
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

const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'bh-prem-'));
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
  const pos = () => js(`(document.querySelector('#film-pos') || {}).textContent || ''`);
  const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);

  await cdp.send('Page.navigate', { url: APP });
  await waitFor(`!!document.querySelector('#film .page')`, 25000, '首映礼分镜区');

  console.log('\n== 1. 每一页的画面都画出来了 ==');
  const pages = await js(`Array.from(document.querySelectorAll('#film .page')).map(pg => ({
    caption: (pg.querySelector('.page-caption') || {}).textContent || '',
    hasImg: !!pg.querySelector('.svgbox img'),
    imgOk: (pg.querySelector('.svgbox img') || {}).naturalWidth > 0,
    hasSvg: !!pg.querySelector('.svgbox svg'),
    empty: !!pg.querySelector('.svgbox.empty'),
    badge: (pg.querySelector('.ai-pic') || {}).textContent || '',
  }))`);
  check('分镜区有封面 + 4 页', pages.length === 5, pages.length + ' 页');
  check('第 1 页显示的是 AI 画的那张图', pages[1].hasImg && pages[1].imgOk, JSON.stringify(pages[1]).slice(0, 80));
  check('AI 图上有「AI 画的」标记', /AI/.test(pages[1].badge), pages[1].badge);
  check('第 2 页没有 AI 图时退回程序化插画', pages[2].hasSvg && !pages[2].hasImg);
  check('第 3 页什么都没有时给占位,不是空灰框', pages[3].empty, JSON.stringify(pages[3]).slice(0, 80));
  check('第 4 页 AI 图和插画都在时优先 AI 图', pages[4].hasImg && pages[4].imgOk);

  console.log('\n== 2. 缩略图胶片条 ==');
  const thumbs = await js(`Array.from(document.querySelectorAll('#filmstrip .thumb')).map(t => ({
    hasImg: !!t.querySelector('img'), imgOk: (t.querySelector('img') || {}).naturalWidth > 0,
    hasSvg: !!t.querySelector('svg'), cur: t.classList.contains('cur'), fi: t.dataset.fi,
  }))`);
  check('缩略图数量和页数一致(封面 + 4 页)', thumbs.length === 5, thumbs.length + ' 个');
  check('有 AI 图的缩略图也显示 AI 图', thumbs[1].hasImg && thumbs[1].imgOk);
  check('只有插画的缩略图显示插画', thumbs[2].hasSvg);
  check('当前页的缩略图有高亮', thumbs.filter(t => t.cur).length === 1, '高亮 ' + thumbs.filter(t => t.cur).length + ' 个');

  console.log('\n== 3. 翻页 ==');
  check('初始停在封面', (await pos()).trim() === '1 / 5', await pos());
  await click('#btn-next');
  await sleep(120);
  check('下一页到第 1 页', (await pos()).trim() === '2 / 5', await pos());
  const visible = await js(`Array.from(document.querySelectorAll('#film .page')).findIndex(p => p.style.display !== 'none')`);
  check('只有一页可见,且是第 1 页', visible === 1, '可见页索引 ' + visible);
  const curThumb = await js(`(document.querySelector('#filmstrip .thumb.cur') || {}).dataset.fi`);
  check('缩略图高亮跟着翻页走', String(curThumb) === '1', 'fi=' + curThumb);
  await click('#btn-prev');
  await sleep(120);
  check('上一页回到封面', (await pos()).trim() === '1 / 5', await pos());
  await click('#btn-prev');
  await sleep(120);
  check('封面再往前不会越界', (await pos()).trim() === '1 / 5', await pos());
  await click('#filmstrip .thumb[data-fi="3"]');
  await sleep(120);
  check('点缩略图能直接跳到那一页', (await pos()).trim() === '4 / 5', await pos());
  for (let i = 0; i < 6; i++) { await click('#btn-next'); await sleep(60); }
  check('最后一页再往后不会越界', (await pos()).trim() === '5 / 5', await pos());

  console.log('\n== 4. 自动翻页 ==');
  await click('#btn-auto');
  await sleep(300);
  const autoLabel = await js(`(document.querySelector('#btn-auto') || {}).textContent || ''`);
  check('点一下自动翻页:按钮变成"停止"', /停止/.test(autoLabel), autoLabel.trim());
  const beforeAuto = await pos();
  await sleep(3200);
  const afterAuto = await pos();
  check('自动翻页真的在翻', afterAuto.trim() !== beforeAuto.trim(), beforeAuto.trim() + ' → ' + afterAuto.trim());
  await click('#btn-next');
  await sleep(200);
  const labelAfterManual = await js(`(document.querySelector('#btn-auto') || {}).textContent || ''`);
  check('手动翻页会自动停掉自动翻页', /自动翻页/.test(labelAfterManual), labelAfterManual.trim());
  const posManual = await pos();
  await sleep(3200);
  check('停掉以后不会自己再往前走', (await pos()).trim() === posManual.trim(), posManual.trim() + ' → ' + (await pos()).trim());

  await click('#btn-auto');
  await sleep(300);
  const startedAgain = await js(`(document.querySelector('#btn-auto') || {}).textContent || ''`);
  await click('.step[data-step="5"]');
  await sleep(400);
  const labelLeft = await js(`(document.querySelector('#btn-auto') || {}).textContent || ''`);
  check('离开首映礼时自动翻页被收拾干净', /停止/.test(startedAgain) && /自动翻页/.test(labelLeft), startedAgain.trim() + ' → ' + labelLeft.trim());

  console.log('\n== 5. 成片播放器与下载 ==');
  await click('.step[data-step="6"]');
  await sleep(400);
  const player = await js(`(() => {
    const a = document.querySelector('#film-player a[download]');
    const v = document.querySelector('#film-player video');
    return {
      hasVideo: !!v,
      src: (v || {}).src || '',
      download: (a || {}).getAttribute ? a.getAttribute('download') : '',
      text: (document.querySelector('#film-player .smallmsg') || {}).textContent || '',
    };
  })()`);
  check('播放器里有片子', player.hasVideo && player.src.includes('test-film.mp4'), player.src);
  check('下载名用的是真实格式 .mp4(不是写死的 .webm)', /\.mp4$/.test(player.download || ''), player.download);
  check('显示的是片长而不是生成耗时', /45\s*秒/.test(player.text) && !/120\s*秒/.test(player.text), player.text.slice(0, 70));

  console.log('\n== 6. 幕后与其它 ==');
  await click('#btn-backstage');
  await sleep(200);
  const backstage = await js(`(() => { const b = document.querySelector('#backstage');
    return { visible: b && !b.classList.contains('hidden'), text: (b || {}).textContent || '' }; })()`);
  check('幕后能打开并列出每格提示词', backstage.visible && /画面提示词/.test(backstage.text));

  console.log('\n== 7. 装订成册:AI 画面要跟着存下来 ==');
  await js(`(() => { const t = document.querySelector('#in-title'); if (t) t.value = '翻页测试'; return true; })()`);
  await click('#btn-save');
  await sleep(900);
  const saved = await js(`(() => {
    const raw = localStorage.getItem('bh_archive') || '[]';
    const list = JSON.parse(raw);
    const w = list[0] || {};
    return {
      works: list.length,
      thumbs: (w.panels || []).map(p => (p.thumb || '').length),
      bytes: raw.length,
      videoUrl: w.videoUrl || '',
      cover: !!document.querySelector('.arch-thumb img'),
    };
  })()`);
  check('作品进了作品库', saved.works === 1, saved.works + ' 部');
  check('两格有 AI 图的作品,存档里保留了画面', saved.thumbs.filter(n => n > 0).length === 2, '缩略图长度 ' + saved.thumbs.join('/'));
  check('存档不会撑爆本机存储(单部 < 400KB)', saved.bytes > 0 && saved.bytes < 400000, Math.round(saved.bytes / 1024) + ' KB');
  check('作品库封面用的是画面', saved.cover);

  console.log('\n== 8. 重看:画面和片子都还在 ==');
  await click('#btn-archive');
  await sleep(400);
  const replayed = await click('.arch-item [data-act="replay"]');
  await sleep(900);
  const afterReplay = await js(`(() => {
    const pages = Array.from(document.querySelectorAll('#film .page')).map(pg => {
      const img = pg.querySelector('.svgbox img');
      return { hasImg: !!img, imgOk: !!img && img.naturalWidth > 0, empty: !!pg.querySelector('.svgbox.empty') };
    });
    return {
      pages,
      video: !!document.querySelector('#film-player video'),
      pos: (document.querySelector('#film-pos') || {}).textContent || '',
    };
  })()`);
  check('能点开重看', replayed);
  check('重看时 AI 画面还在,没有退化成空框', afterReplay.pages.slice(1).filter(p => p.hasImg && p.imgOk && !p.empty).length === 2,
    JSON.stringify(afterReplay.pages.slice(1)));
  check('重看时片子也还在', afterReplay.video, '页码 ' + afterReplay.pos.trim());

  console.log('\n== 9. 页面没有报错 ==');
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
