/* 抽卡页长按拖动 · 真浏览器回归测试
   用法:先起前端(双击 启动游戏.cmd 或 npm run dev),再执行
        node tests/e2e-drag.mjs
   会拉起一个隐藏的无头 Edge/Chrome,自动「开拍 → 全部随机抽」,
   然后用 PointerEvent 模拟长按拖动,断言换卡、格子排序、误触取消三种情况,
   最后存一张截图到 tests/e2e-drag-shot.png。 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.BH_APP_URL || 'http://127.0.0.1:5174/';
const PORT = Number(process.env.BH_CDP_PORT || 9333);
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
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + String(extra).slice(0, 140) : ''));
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
    } catch { /* 浏览器还没起来 */ }
    await sleep(150);
  }
  throw new Error('无头浏览器没起来,检查 Edge/Chrome 是否安装');
}

const browserPath = BROWSERS.find(p => p && existsSync(p));
if (!browserPath) { console.error('找不到 Edge 或 Chrome'); process.exit(1); }

const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'bh-drag-'));
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

  const js = async expr => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面脚本出错:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, timeout = 10000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await js(expr)) return true; } catch { /* 还没渲染好 */ }
      await sleep(120);
    }
    throw new Error('等超时:' + expr);
  };
  const cards = () => js(`Array.from(document.querySelectorAll('#slot-grid .slotcard .slot-card b')).map(b=>b.textContent)`);
  const names = () => js(`Array.from(document.querySelectorAll('#slot-grid .slotcard .slot-name')).map(s=>s.textContent.trim())`);

  /* 模拟一次长按拖动:按住 fromSel,等 hold 毫秒,一路移到 toSel,松手。
     cancelMove>0 时先在长按生效前挪动一小段(模拟页面滚动),应该拖不动。 */
  const drag = (fromSel, toSel, { hold = 260, cancelMove = 0 } = {}) => js(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const src = document.querySelector(${JSON.stringify(fromSel)});
    const dst = document.querySelector(${JSON.stringify(toSel)});
    if (!src || !dst) return 'missing handle';
    src.scrollIntoView({ block: 'center' });
    await sleep(60);
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    const fire = (type, x, y) => src.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
      buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
    }));
    fire('pointerdown', sx, sy);
    if (${cancelMove} > 0) { fire('pointermove', sx + ${cancelMove}, sy); await sleep(30); }
    await sleep(${hold});
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      fire('pointermove', sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps);
      await sleep(20);
    }
    fire('pointerup', tx, ty);
    await sleep(140);
    return 'ok';
  })()`);

  await cdp.send('Page.navigate', { url: APP });
  await waitFor(`!!document.querySelector('#btn-newfilm')`);

  console.log('\n== 1. 抽卡页界面 ==');
  check('抽卡页没有 ◀ ▶ 调顺序按钮', await js(`document.querySelectorAll('#slot-grid [data-act="left"],#slot-grid [data-act="right"]').length === 0`));
  check('抽卡页没有 🔀 换格按钮', await js(`document.querySelectorAll('#slot-grid [data-act="move"],[data-act="movehere"],.slot-acts2').length === 0`));

  await js(`document.querySelector('#btn-newfilm').click()`);
  await waitFor(`!!document.querySelector('#slot-grid .slotcard')`);
  await js(`document.querySelector('#btn-drawall').click()`);
  await sleep(300);

  const drawn = await cards();
  check('全部随机抽:六格都有卡', drawn.length === 6 && drawn.every(Boolean), drawn.join(' / '));
  check('可拖动的卡片都带 data-drag=card', await js(`document.querySelectorAll('#slot-grid .slot-card[data-drag="card"]').length`) === 6);
  check('格子名都带 data-drag=slot', await js(`document.querySelectorAll('#slot-grid .slot-head[data-drag="slot"]').length`) === 6);
  check('可选卡右上角还有 ✖(丢卡)', await js(`document.querySelectorAll('#slot-grid .slotcard:not(.req) [data-act="clearcard"]').length`) > 0);
  check('必抽格没有 ✖', await js(`document.querySelectorAll('#slot-grid .slotcard.req [data-act="clearcard"]').length`) === 0);

  console.log('\n== 2. 长按卡片拖动:换卡 ==');
  const before = await cards();
  const namesBeforeSwap = await names();
  const r1 = await drag(`#slot-grid .slotcard[data-i="0"] .slot-card`, `#slot-grid .slotcard[data-i="1"] .slot-card`);
  const afterSwap = await cards();
  check('拖动真的生效了', r1 === 'ok', r1);
  check('第 1、2 格的卡互换了', afterSwap[0] === before[1] && afterSwap[1] === before[0], before[0] + '↔' + before[1] + ' → ' + afterSwap[0] + '↔' + afterSwap[1]);
  check('换卡没有改变格子顺序', (await names()).join('/') === namesBeforeSwap.join('/'), namesBeforeSwap.join('/'));

  console.log('\n== 3. 长按格子名拖动:整格排序 ==');
  const namesBefore = await names();
  const cardsBefore = await cards();
  const r2 = await drag(`#slot-grid .slotcard[data-i="0"] .slot-head`, `#slot-grid .slotcard[data-i="3"] .slot-head`);
  const namesAfter = await names();
  const cardsAfter = await cards();
  check('整格拖动生效了', r2 === 'ok', r2);
  check('格子顺序变了', namesBefore.join('/') !== namesAfter.join('/'), namesBefore.join('/') + ' → ' + namesAfter.join('/'));
  check('被拖的格子落在第 4 位', namesAfter[3] === namesBefore[0], '落在第4位的是:' + namesAfter[3]);
  check('卡跟着格子一起走', cardsAfter[3] === cardsBefore[0], cardsBefore[0] + ' → ' + cardsAfter[3]);
  check('格子总数没变', namesAfter.length === 6);

  console.log('\n== 4. 误触保护:先滑动就不进入拖动 ==');
  const guardBefore = await cards();
  const r3 = await drag(`#slot-grid .slotcard[data-i="0"] .slot-card`, `#slot-grid .slotcard[data-i="1"] .slot-card`, { cancelMove: 40 });
  const guardAfter = await cards();
  check('移动超过 12px 就不算长按', guardAfter.join('/') === guardBefore.join('/'), guardBefore.join('/') + ' → ' + guardAfter.join('/'));

  console.log('\n== 5. 拖动过程中的样子 ==');
  const mid = await js(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const src = document.querySelector('#slot-grid .slotcard[data-i="0"] .slot-card');
    const dst = document.querySelector('#slot-grid .slotcard[data-i="3"]');
    src.scrollIntoView({ block: 'center' });
    await sleep(60);
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const fire = (t, x, y, on) => (on || src).dispatchEvent(new PointerEvent(t, {
      bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse',
      isPrimary: true, button: 0, buttons: t === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
    }));
    fire('pointerdown', sx, sy);
    await sleep(280);
    const ghost = document.querySelector('.drag-ghost');
    const out = {
      ghost: !!ghost,
      ghostText: ghost ? ghost.textContent.trim() : '',
      cardText: src.querySelector('b') ? src.querySelector('b').textContent : '',
      bodyClass: document.body.className,
      sourceDimmed: src.classList.contains('dragging'),
    };
    fire('pointermove', sx + 30, sy + 20);
    await sleep(30);
    fire('pointermove', b.left + b.width / 2, b.top + b.height / 2);
    await sleep(60);
    out.hover = dst.classList.contains('dragover');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(80);
    out.cleaned = !document.querySelector('.drag-ghost')
      && document.body.className.indexOf('bh-dragging') < 0
      && document.querySelectorAll('#slot-grid .dragover, #slot-grid .dragging').length === 0;
    fire('pointerup', sx, sy);
    return out;
  })()`);
  check('长按后出现跟手的浮层', mid.ghost, mid.ghostText);
  check('浮层显示的是被拖的卡', mid.ghostText.includes(mid.cardText), mid.ghostText + ' / ' + mid.cardText);
  check('原卡片变淡(拖动中)', mid.sourceDimmed);
  check('目标格子高亮', mid.hover);
  check('body 标了拖动状态(桌面禁止选中文字)', /bh-dragging-card/.test(mid.bodyClass), mid.bodyClass);
  check('按 Esc 取消,浮层和高亮都清干净', mid.cleaned);

  console.log('\n== 6. 鼠标和手指都能拖 ==');
  check('卡片是"抓手"光标', await js(`getComputedStyle(document.querySelector('#slot-grid .slot-card[data-drag]')).cursor`) === 'grab');
  check('格子名也是"抓手"光标', await js(`getComputedStyle(document.querySelector('#slot-grid .slot-head')).cursor`) === 'grab');
  check('触屏上按住手柄不会触发页面滚动', await js(`getComputedStyle(document.querySelector('#slot-grid .slot-card[data-drag]')).touchAction`) === 'none');

  console.log('\n== 7. 手机触摸指针同样能拖 ==');
  const touchBefore = await cards();
  const touchSwap = await js(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const src = document.querySelector('#slot-grid .slotcard[data-i="0"] .slot-card');
    const dst = document.querySelector('#slot-grid .slotcard[data-i="2"] .slot-card');
    if (!src || !dst) return 'missing';
    src.scrollIntoView({ block: 'center' });
    await sleep(60);
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    if (ty < 0 || ty > window.innerHeight || tx < 0 || tx > window.innerWidth) return 'offscreen';
    const fire = (type, x, y) => src.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0,
      buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
    }));
    fire('pointerdown', sx, sy);
    await sleep(280);
    const ghostShown = !!document.querySelector('.drag-ghost');
    for (let i = 1; i <= 6; i++) { fire('pointermove', sx + (tx - sx) * i / 6, sy + (ty - sy) * i / 6); await sleep(20); }
    fire('pointerup', tx, ty);
    await sleep(140);
    return ghostShown ? 'ok' : 'ghost missing';
  })()`);
  const touchAfter = await cards();
  check('手指长按也能拖出浮层并换卡', touchSwap === 'ok', touchSwap);
  check('触摸拖动的结果对', touchAfter[0] === touchBefore[2] && touchAfter[2] === touchBefore[0], touchBefore[0] + '↔' + touchBefore[2] + ' → ' + touchAfter[0] + '↔' + touchAfter[2]);

  console.log('\n== 8. ✖ 丢卡按钮没被拖动抢掉 ==');
  const optionalSel = `#slot-grid .slotcard:not(.req)`;
  const cardBeforeX = await js(`document.querySelectorAll('${optionalSel} .slot-card b')[0].textContent`);
  const longPressOnX = await js(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const x = document.querySelector('${optionalSel} [data-act="clearcard"]');
    if (!x) return 'no button';
    const r = x.getBoundingClientRect();
    const fire = (type) => x.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: 'touch',
      isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    }));
    fire('pointerdown');
    await sleep(280);
    const dragging = !!document.querySelector('.drag-ghost');
    fire('pointerup');
    await sleep(120);
    return dragging ? 'dragging' : 'no drag';
  })()`);
  check('按 ✖ 不会进入拖动模式', longPressOnX === 'no drag', longPressOnX);
  await js(`document.querySelectorAll('${optionalSel} [data-act="clearcard"]')[0].click()`);
  await sleep(150);
  const cardAfterX = await js(`document.querySelectorAll('${optionalSel} .slot-card b')[0] ? document.querySelectorAll('${optionalSel} .slot-card b')[0].textContent : '(空了)'`);
  check('点 ✖ 能把这张卡丢掉', cardAfterX !== cardBeforeX, cardBeforeX + ' → ' + cardAfterX);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL('./e2e-drag-shot.png', import.meta.url), Buffer.from(shot.data, 'base64'));

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
