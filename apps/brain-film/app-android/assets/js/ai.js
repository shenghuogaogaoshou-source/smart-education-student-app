/* ============================================================
   脑洞放映厅 · AI 接入层(v5)
   四个能力全部走后端 /api/*(Key 在服务器,浏览器拿不到任何 Key):
     故事简介 / 写剧本 / 提示词润色 → GLM-5.2
     画分镜                          → Seedream 5.0 Lite
     生成影片                        → Seedance(自动挑账号已开通的)
     配音                            → GLM-TTS
   本文件是"插件":只从外面包一层,不改 game.js 主逻辑;
   没有后端 / --no-ai / ?demo=1 时,游戏照旧离线可玩。
   ============================================================ */
/* global G, $, $$, esc, toast, lg, store, renderIdea, renderStory, renderPanels, renderPrem, renderPlayer, buildSVG, drawPage, synopsisText, ideaToStoryDraft, initPanels */

const BK = {
  ok: false,
  enabled: !/[?&]demo=1/.test(location.search),   // ?demo=1 = 强制离线(测试/断网课堂)
  mod: {},
  usage: { imgLeft: 12, videoLeft: 30 },
  busy: { story: false, img: {}, video: false },
  lastErr: '',
};

async function bkFetch(path, body, ms) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(ms || 180000) : undefined,
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg = j.error || msg; } catch (e) {}
    BK.lastErr = msg;
    throw new Error(msg);
  }
  return await r.json();
}
const bkGet = (p, ms) => bkFetch(p, null, ms);
const bkPost = (p, b, ms) => bkFetch(p, b, ms);

async function bkBoot() {
  try {
    const data = await bkGet('/api/config', 25000);
    BK.ok = !!data.backend;
    BK.mod = data.modules || {};
    if (data.limits) { BK.usage.imgLeft = data.limits.images; BK.usage.videoLeft = data.limits.videosPerDay; }
    if (!BK.enabled) Object.keys(BK.mod).forEach(k => { BK.mod[k] = { ready: false, off: true, model: BK.mod[k].model }; });
  } catch (e) { BK.ok = false; BK.lastErr = String(e.message || e); }
  bkBadge();
}
async function bkRefresh() {           /* 网络状态可能变了,用之前再问一次 */
  try { const d = await bkGet('/api/config', 6000); if (d.modules) BK.mod = d.modules; bkBadge(); } catch (e) {}
}
const ready = k => !!(BK.enabled && BK.mod[k] && BK.mod[k].ready);
const modelOf = k => (BK.mod[k] && BK.mod[k].model) || '';

/* ---------- 顶部「AI 片场」徽章 ---------- */
function bkBadge() {
  let el = $('#ai-badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ai-badge';
    el.className = 'ai-badge';
    (document.querySelector('header .row') || document.body).appendChild(el);
  }
  if (!BK.ok) {
    el.innerHTML = '🔌 离线模式(全部本机,免费用)';
    el.title = '没连上后端:游戏照旧能玩——剧本走整理模式、画面走程序化插画、影片本机录制';
    return;
  }
  const chip = (k, name, icon) => {
    const m = BK.mod[k] || {};
    if (!ready(k)) return `<span class="ai-off" title="服务器没配这一项的 Key,或用了 --no-ai">${icon} ${name}</span>`;
    if (m.reach === false) return `<span class="ai-bad" title="这台电脑现在连不上 ${m.net},所以这个功能用不了(可以开代理后在 .env 里填 HTTPS_PROXY)">${icon} ${name}⛔</span>`;
    return `<span class="ai-on" title="用 ${esc(m.model)}">${icon} ${name}</span>`;
  };
  el.innerHTML = '<span class="ai-title">AI 片场:</span>' + chip('synopsis', '简介', '📖') + chip('story', '编剧', '✍️') +
    chip('polish', '润色', '✨') + chip('image', '画师', '🎨') + chip('video', '影片', '🎥') + chip('tts', '配音', '🎙️');
}

const myAI = () => ((typeof G !== 'undefined' && G && G.intern) || '小映');   /* G 是全局词法变量,不在 window 上 */
const cardsOf = () => (G.slots || []).filter(s => s.card).map(s => ({ slot: s.name, card: s.card.t }));

/* ============================================================
   ② 讲想法:故事简介交给 GLM-5.2 写通顺
   ============================================================ */
function ensureIdeaUI() {
  const box = $('#idea-synopsis');
  if (!box) return;
  if ($('#btn-ai-syn')) {                          /* 按钮已在页面里:只需挂事件 */
    if (!$('#btn-ai-syn')._wired) {
      $('#btn-ai-syn')._wired = true;
      $('#btn-ai-syn').onclick = () => aiSynopsis(false);
      $('#btn-ai-syn-again').onclick = () => aiSynopsis(true);
    }
    return;
  }
  const tag = document.createElement('div');
  tag.id = 'idea-syn-tag';
  tag.className = 'smallmsg';
  tag.style.marginTop = '4px';
  box.parentNode.insertBefore(tag, box.nextSibling);
  const row = document.createElement('div');
  row.className = 'row';
  row.style.margin = '8px 0';
  row.innerHTML = '<button id="btn-ai-syn" class="btn btn-primary">✨ 让 AI 把简介写通顺</button>' +
    '<button id="btn-ai-syn-again" class="btn btn-mini">🔁 换一版</button>' +
    '<span id="ai-syn-msg" class="smallmsg"></span>';
  tag.parentNode.insertBefore(row, tag.nextSibling);
  $('#btn-ai-syn').onclick = () => aiSynopsis(false);
  $('#btn-ai-syn-again').onclick = () => aiSynopsis(true);
}

let _synSig = '';
async function aiSynopsis(regen) {
  const btn = $('#btn-ai-syn'), msg = $('#ai-syn-msg');
  const say = t => { if (msg) msg.textContent = t; };
  if (!ready('synopsis')) { say('❌ 简介模型没就绪(看顶部 AI 片场徽章)'); return; }
  if (!cardsOf().length) { say('先去第 1 步抽几张卡吧'); return; }
  _synSig = sigOfCards();
  if (btn) { btn.disabled = true; btn.textContent = '📖 AI 组织语言中…'; }
  say('⏳ 正在把卡和你的补充写成一段通顺的简介…');
  try {
    const t0 = Date.now();
    const d = await bkPost('/api/synopsis', { cards: cardsOf(), idea: ($('#ta-idea') && $('#ta-idea').value) || G.idea || '' }, 90000);
    const syn = String(d.synopsis || '').trim();
    if (!syn) throw new Error('模型没返回内容');
    G.synopsis = syn;
    if (typeof renderIdea === 'function') renderIdea();
    lg('synopsis', 'AI 写好了故事简介(' + Math.round((Date.now() - t0) / 1000) + ' 秒)');
    say('✅ ' + modelOf('synopsis') + ' 写的 · ' + Math.round((Date.now() - t0) / 1000) + ' 秒' + (regen ? '(换了一版)' : ''));
    toast('📖 简介写通顺了,不满意可以再换一版');
  } catch (e) {
    say('❌ ' + String(e.message || e) + '(先用程序拼的那版也没关系)');
  }
  if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 把简介写通顺'; }
}
const sigOfCards = () => cardsOf().map(c => c.slot + ':' + c.card).join('|');
/* 卡片一变,旧简介就作废:下次进"讲想法"自动重写 */
async function autoSynopsis() {
  ensureIdeaUI();
  if (!ready('synopsis')) return;
  if (!cardsOf().length) return;
  if (G.synopsis && _synSig === sigOfCards()) return;
  await aiSynopsis(false);
}

/* ============================================================
   ③ 写剧本:直接让 AI 用"卡 + 想法"生成,孩子再改
   ============================================================ */
const STORY_BUSY = '⏳ AI 编剧正在写剧本…\n(用的是你抽到的卡和上面补充的想法)';

function aiScriptFromIdea() {            // 返回 true = 交给 AI 写(由 ai.js 接管)
  if (!ready('story')) return false;
  if (BK.busy.story) return true;
  aiWriteStory(false, true);
  return true;
}

async function aiWriteStory(regen, auto) {
  const btn = $('#btn-ai-story'), msg = $('#ai-story-msg'), ta = $('#ta-story'), bub = $('#bub-story');
  const say = t => { if (msg) msg.textContent = t; };
  if (!ready('story')) { say('❌ 编剧模型没就绪(看顶部 AI 片场徽章)'); return; }
  if (BK.busy.story) return;
  BK.busy.story = true;
  const oldLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '✍️ 编剧动笔中…'; }
  if (auto) {
    if (ta) ta.value = STORY_BUSY;
    if (bub) bub.innerHTML = '🤖 ' + esc(myAI()) + ':稍等一下,我在把「抽到的卡 + 你补充的想法」编成剧本…';
  }
  say('⏳ ' + modelOf('story') + ' 正在写(通常 2~10 秒)…');
  try {
    G.idea = ($('#ta-idea') && $('#ta-idea').value) || G.idea || '';
    const t0 = Date.now();
    const d = await bkPost('/api/story', {
      cards: cardsOf(), idea: G.idea, synopsis: G.synopsis || synopsisText(),
      old: regen ? (ta && ta.value) || G.story || '' : '',
    }, 180000);
    const lines = (d.lines || []).filter(Boolean);
    if (!lines.length) throw new Error('编剧没写出内容,再点一次试试');
    G.story = lines.join('\n');
    G.storyDraft = G.story;
    G.panels = []; G.panelsStale = true;
    if (ta) ta.value = G.story;
    const secs = Math.round((Date.now() - t0) / 1000);
    lg('story', 'AI 编剧写出 ' + lines.length + ' 页剧本(' + secs + ' 秒)');
    renderStory();
    say('✅ ' + modelOf('story') + ' 写好了(' + secs + ' 秒 · ' + lines.length + ' 页)。下面是草稿,想改哪儿直接改。');
    toast('✍️ 剧本来了!不满意可以直接改字或点「🔁 换一版」');
  } catch (e) {
    if (auto) {                       // AI 没成 → 退回离线整理草稿,别让孩子卡住
      try { ideaToStoryDraft(); renderStory(); } catch (e2) {}
      say('❌ AI 编剧没成功:' + String(e.message || e) + ';已先用离线草稿顶上,你可以自己改。');
    } else {
      say('❌ ' + String(e.message || e));
    }
  }
  BK.busy.story = false;
  if (btn) { btn.disabled = false; btn.textContent = oldLabel || ('✨ 让' + myAI() + '用 AI 写剧本'); }
}

function ensureStoryUI() {
  const ta0 = $('#ta-story');
  if (!ta0) return;
  if ($('#btn-ai-story')) {                        /* 按钮已在页面里:挂事件 + 更新气泡 */
    $('#btn-ai-story').textContent = '✨ 让' + myAI() + '用 AI 写剧本';   /* 名字改了要跟着变 */
    if (!$('#btn-ai-story')._wired) {
      $('#btn-ai-story')._wired = true;
      $('#btn-ai-story').onclick = () => aiWriteStory(false, true);
      $('#btn-ai-regen').onclick = () => {
        if (ready('story')) return aiWriteStory(true, true);      /* 有 AI → 换一版 */
        G.idea = ($('#ta-idea') && $('#ta-idea').value) || G.idea || '';
        ideaToStoryDraft(); renderStory();                         /* 没 AI → 离线重排 */
        toast('🔁 重新整理好了(离线:只按你说的顺序排)');
      };
    }
    const b0 = $('#bub-story');
    if (b0 && ready('story')) {
      b0.innerHTML = '🤖 ' + esc(myAI()) + ':这是我用 AI 写的剧本——<b>每一行就是一页分镜</b>。' +
        '<br><small>你抽到的卡和补充的想法我都用上了;想改就点「🔁 换一版」,或者直接改文字,你才是导演。</small>';
    }
    return;
  }
  const ta = ta0;
  const row = document.createElement('div');
  row.className = 'row';
  row.style.margin = '6px 0 10px';
  row.innerHTML = '<button id="btn-ai-story" class="btn btn-primary">✨ 让' + myAI() + '用 AI 写剧本</button>' +
    '<button id="btn-ai-regen" class="btn btn-mini">🔁 换一版</button>' +
    '<span id="ai-story-msg" class="smallmsg"></span>';
  ta.parentNode.insertBefore(row, ta);
  $('#btn-ai-story').onclick = () => aiWriteStory(false, true);
  $('#btn-ai-regen').onclick = () => aiWriteStory(true, true);
  const bub = $('#bub-story');
  if (bub && ready('story')) {
    bub.innerHTML = '🤖 ' + esc(G.intern) + ':这是我用 AI 写的剧本——<b>每一行就是一页分镜</b>。' +
      '<br><small>你抽到的卡和补充的想法我都用上了;想改就点「🔁 换一版」,或者直接改文字,你才是导演。</small>';
  }
}

/* ============================================================
   ⑤ 画分镜:Seedream 5.0 Lite 出图 + 提示词润色
   ============================================================ */
function shrinkImg(src, maxW) {           // 把大图压小,免得存草稿时挤爆浏览器
  return new Promise(resolve => {
    if (!/^data:image\//.test(src) || /^data:image\/svg/.test(src)) return resolve(src);
    const im = new Image();
    im.onload = () => {
      try {
        if (im.width <= maxW) return resolve(src);
        const sc = maxW / im.width;
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
        const cx = cv.getContext('2d');
        if (!cx) return resolve(src);
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        const out = cv.toDataURL('image/jpeg', 0.82);
        resolve(out && out.length < src.length ? out : src);
      } catch (e) { resolve(src); }
    };
    im.onerror = () => resolve(src);
    setTimeout(() => resolve(src), 4000);
    im.src = src;
  });
}

async function aiPolish(panelEl) {
  const i = +panelEl.dataset.i, p = G.panels[i];
  if (!p) return;
  p.cap = panelEl.querySelector('.cap').value;
  p.prm = panelEl.querySelector('.prm').value;
  const btn = panelEl.querySelector('.act-polish');
  btn.disabled = true; const old = btn.textContent; btn.textContent = '✨ 润色中…';
  p.aiMsg = '⏳ 让 AI 把提示词写具体…';
  drawAiMsg(panelEl, p);
  try {
    const d = await bkPost('/api/polish', { cap: p.cap, prompt: p.prm, style: G.style }, 90000);
    p.prm = String(d.prompt || '').trim();
    p.aiMsg = '✅ 提示词具体多了,现在点「🖼️ AI 画这格」试试';
    lg('polish', '第 ' + (i + 1) + ' 格提示词润色好了');
  } catch (e) {
    p.aiMsg = '❌ ' + String(e.message || e) + '(也可以自己写清楚:谁·在哪·在做什么)';
  }
  btn.disabled = false; btn.textContent = old;
  renderPanels(); saveDraft();
}

async function aiPaint(panelEl) {
  const i = +panelEl.dataset.i, p = G.panels[i];
  if (!p) return;
  p.cap = panelEl.querySelector('.cap').value;
  p.prm = panelEl.querySelector('.prm').value;
  const btn = panelEl.querySelector('.act-aipaint');
  if (!ready('image')) { p.aiMsg = '❌ 画师模型没就绪(看顶部 AI 片场徽章)'; renderPanels(); return; }
  if (BK.mod.image.reach === false) await bkRefresh();          /* 先确认是不是网络问题 */
  if (BK.mod.image && BK.mod.image.reach === false) {
    p.aiMsg = '⛔ 这台电脑现在连不上火山方舟(出图服务 ' + BK.mod.image.net + ')。可以先点「🎨 重画这格」用免费画师,或者检查网络/代理后再试。';
    renderPanels(); lg('ai-paint', '出图跳过:网络不通'); return;
  }
  if (BK.busy.img[i]) return;
  if ((BK.usage.imgLeft || 0) <= 0) {
    p.aiMsg = '⚠️ 这部片子的 AI 出图额度用完了(每部 12 张),可以点「🎨 重画这格」用免费的程序画师。';
    renderPanels(); return;
  }
  BK.busy.img[i] = true;
  if (btn) { btn.disabled = true; btn.textContent = '🎨 AI 画画中…'; }
  p.aiMsg = '⏳ ' + modelOf('image') + ' 正在画(大约 15~30 秒)…';
  drawAiMsg(panelEl, p);
  const prompt = [G.style, (p.prm || p.cap || '').trim(), '儿童绘本插画,明亮温暖,整张图不出现任何文字'].filter(Boolean).join('。');
  try {
    const t0 = Date.now();
    const d = await bkPost('/api/image', { prompt }, 300000);
    if (!d.src) throw new Error('画师没给图');
    p.img = await shrinkImg(d.src, 1280);      // 压到 1280px,省内存也够放影片
    p.version++;
    p.wrong = null; p.note = ''; p.fix = '';
    p.aiDrawn = true;
    BK.usage.imgLeft = Math.max(0, (BK.usage.imgLeft || 1) - 1);
    const secs = Math.round((Date.now() - t0) / 1000);
    p.aiMsg = '✅ ' + modelOf('image') + ' 画好了(' + secs + ' 秒 · 这部还剩 ' + BK.usage.imgLeft + ' 张额度)';
    lg('ai-paint', '第 ' + (i + 1) + ' 格 AI 出图(' + secs + ' 秒,剩 ' + BK.usage.imgLeft + ' 张)');
    toast('🎨 第 ' + (i + 1) + ' 格画好了!不满意就改提示词再画一次');
  } catch (e) {
    p.aiMsg = '❌ ' + String(e.message || e) + '(可以点「🎨 重画这格」用免费画师,或改改提示词再试)';
    lg('ai-paint', '第 ' + (i + 1) + ' 格出图失败:' + String(e.message || e));
  }
  BK.busy.img[i] = false;
  renderPanels(); saveDraft();
}

function drawAiMsg(panelEl, p) {          // 立刻把状态写进格子(重绘前也能看到)
  const m = panelEl.querySelector('.ai-pmsg');
  if (m) m.textContent = p.aiMsg || '';
}

function augmentPanels() {
  $$('#panel-grid .panel').forEach(el => {
    const i = +el.dataset.i, p = G.panels[i] || {};
    const acts = el.querySelector('.panel-actions');
    if (!acts) return;
    let m = el.querySelector('.ai-pmsg');
    if (!m) { m = document.createElement('div'); m.className = 'smallmsg ai-pmsg'; el.appendChild(m); }
    m.textContent = p.aiMsg || '';
    if (acts.querySelector('.act-aipaint')) return;      // 已经加过按钮
    const b1 = document.createElement('button');
    b1.className = 'btn btn-mini act-polish';
    b1.textContent = '✨ 帮我把提示词写具体';
    const b2 = document.createElement('button');
    b2.className = 'btn btn-mini btn-primary act-aipaint';
    b2.textContent = '🖼️ AI 画这格';
    acts.appendChild(b1); acts.appendChild(b2);
  });
}
function showAiImages() {
  $$('#panel-grid .panel').forEach(el => {
    const p = G.panels[+el.dataset.i];
    const box = el.querySelector('.svgbox');
    if (p && p.img && box && !box.querySelector('img')) {
      box.innerHTML = '<img src="' + esc(p.img) + '" alt="AI 画面" style="width:100%;height:100%;object-fit:cover;display:block">' +
        '<span class="ai-pic">🎨 AI 画的</span>';
    }
  });
}

/* ============================================================
   ⑥ 首映礼:Seedance 出片 + GLM-TTS 配音
   ============================================================ */
function imgToDataUrl(src, w, h) {
  return new Promise(resolve => {
    const im = new Image();
    let done = false; const fin = v => { if (!done) { done = true; resolve(v); } };
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d');
        if (!cx) return fin('');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        fin(cv.toDataURL('image/jpeg', 0.9));
      } catch (e) { fin(''); }
    };
    im.onerror = () => fin('');
    setTimeout(() => fin(''), 5000);
    im.src = src;
  });
}
function panelImageDataUrl(i) {           // 第 i 格的画面 → 给图生视频当首帧
  const p = G.panels[i] || G.panels[0];
  if (p && p.img) return imgToDataUrl(p.img, 1024, 640);
  const src = (p && p.svg) || buildSVG(p || { cap: '故事' }, i);
  return imgToDataUrl('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src.replace('<svg ', '<svg width="1024" height="640" ')), 1024, 640);
}
function videoPrompt() {
  const cards = cardsOf().map(c => c.card).join('、');
  const script = (G.story || '').split('\n').map(x => x.trim()).filter(Boolean).join(' ');
  return ('儿童动画:' + (cards ? cards + '。' : '') + script + '。画风:' + (G.style || '儿童绘本') +
    ',镜头平稳,颜色明亮,适合小学生观看').slice(0, 500);
}
async function aiMakeFilm() {          /* 一条龙:剧本+画面 → 影片,再配上 GLM-TTS 旁白 */
  const btn = $('#btn-film-ai'), msg = $('#film-msg');
  const say = t => { if (msg) msg.textContent = t; };
  if (BK.busy.video) { say('⏳ 上一部还在生成,别急,好了会自己出现'); return; }
  if (!ready('video')) { say('❌ 影片模型没就绪(看顶部 AI 片场徽章);可以先点「🎬 本机录制(免费)」'); return; }
  if (BK.mod.video.reach === false) await bkRefresh();
  if (BK.mod.video && BK.mod.video.reach === false) {
    say('⛔ 这台电脑现在连不上火山方舟(影片服务 ' + BK.mod.video.net + ')。可以先点「🎬 本机录制(免费)」把剧本和分镜录成片子,或者检查网络/代理后再试。');
    return;
  }
  if (!G.panels.length) { say('❌ 还没有分镜,先回第 5 步'); return; }
  BK.busy.video = true;
  if (btn) { btn.disabled = true; btn.textContent = '🎬 生成中…'; }
  try {
    say('⏳ ① 把你的第一格画面交给视频模型…');
    const img = await panelImageDataUrl(0);
    say('⏳ ② 提交任务(剧本 + 画面 → 视频)…');
    const d = await bkPost('/api/video', { prompt: videoPrompt(), image: img || undefined, duration: 5, resolution: '720p', ratio: '16:9' }, 240000);
    if (!d.taskId) throw new Error('没拿到任务号');
    lg('video', '提交视频任务 ' + d.taskId + ' · ' + d.model);
    const t0 = Date.now();
    let out = null, fails = 0;
    while (Date.now() - t0 < 600000) {
      await new Promise(r => setTimeout(r, 6000));
      let g;
      try { g = await bkGet('/api/video/' + d.taskId, 40000); } catch (e) {
        fails++;
        if (fails >= 5) throw new Error('查询生成进度失败:' + String(e.message || e));
        say('⏳ 查询失败了一次,重试中…(' + fails + '/5)');
        continue;
      }
      fails = 0;
      const sec = Math.round((Date.now() - t0) / 1000);
      if (g.status === 'succeeded' && g.videoUrl) { out = g; break; }
      if (g.status === 'failed' || g.status === 'expired') {
        throw new Error('视频生成失败:' + ((g.error && (g.error.message || g.error.code)) || g.status));
      }
      say('⏳ ③ 视频生成中…已等 ' + sec + ' 秒(通常 10~60 秒)');
    }
    if (!out) throw new Error('等太久了(超过 10 分钟),可以先点「🎬 本机录制(免费)」');
    const secs = Math.round((Date.now() - t0) / 1000);
    lg('video', '画面好了:' + (out.model || d.model) + ' · ' + secs + ' 秒 · 约 ¥' + (out.cost || '-'));
    /* ④ 配旁白:把剧本交给 GLM-TTS,和画面合成一条 */
    let finalUrl = out.videoUrl, label = out.model || d.model, cost = out.cost || 0;
    if (ready('tts')) {
      say('⏳ ④ 正在配旁白并合成(用你的剧本,约 5~20 秒)…');
      try {
        const lines = (G.story || '').split('\n').map(x => x.trim()).filter(Boolean);
        const m = await bkPost('/api/film', { videoUrl: out.videoUrl, lines, title: ($('#in-title') && $('#in-title').value) || '', duration: 5 }, 300000);
        if (m && m.url) {
          finalUrl = m.url;
          label = (out.model || d.model) + ' + ' + modelOf('tts') + ' 配音';
          lg('video', '配音合成好了:' + m.url);
        }
      } catch (e) {
        say('⚠️ 画面好了,但配音没合上(' + String(e.message || e) + '),先给你无声版。');
      }
    }
    G.videoUrl = finalUrl;
    G.videoModel = label;
    G.filmMs = Date.now() - t0;
    G.videoCost = cost;
    renderPlayer();
    say('✅ 影片好了!就在上面播放(' + label + ' · 约 ¥' + (cost || '-') + ')。看完记得往下起名字、写评论。');
    toast('🎥 影片生成成功,先看片再起名字!');
  } catch (e) {
    say('❌ ' + String(e.message || e) + '(也可以点「🎬 本机录制(免费)」)');
    lg('video', '生成失败:' + String(e.message || e));
  }
  BK.busy.video = false;
  if (btn) { btn.disabled = false; btn.textContent = '🎬 生成影片 + 配音'; }
}

function ensurePremUI() {
  const fb = $('#btn-film-ai');
  if (fb && !fb._wired) {
    fb._wired = true;
    fb.onclick = aiMakeFilm;
    if (!ready('video')) fb.title = '影片模型没就绪(见顶部 AI 片场)';
  }
  const mb = $('#btn-makefilm');
  if (mb && !mb._wired) {
    mb._wired = true;
    /* 本机录制:有 TTS 就用 GLM-TTS 当配音轨,没有就用浏览器朗读 */
    mb.onclick = async () => {
      const msg = $('#film-msg');
      if (!ready('tts')) {
        toast('离线模式:用浏览器自带朗读');
        try {
          const r = await makeFilm(x => { if (msg) msg.textContent = '⏳ ' + x; });
          if (msg) msg.textContent = '✅ 影片好了(' + r.pages + ' 页 · ' + Math.round(r.ms / 1000) + ' 秒)';
          renderPlayer();
        } catch (e) { if (msg) msg.textContent = '❌ ' + String(e.message || e); }
        return;
      }
      const b = $('#btn-makefilm'); b.disabled = true; const t = b.textContent; b.textContent = '🎙️ 配音 + 录制中…';
      try {
        const r = await makeFilmAI(x => { if (msg) msg.textContent = '⏳ ' + x; });
        if (msg) msg.textContent = '✅ 影片好了(' + r.pages + ' 页 · ' + Math.round(r.ms / 1000) + ' 秒 · ' + Math.round(r.size / 1024) + ' KB · 配音:' + modelOf('tts') + ')';
        renderPlayer(); toast('🎥 带 AI 配音的影片好了!');
      } catch (e) {
        if (msg) msg.textContent = '❌ ' + String(e.message || e);
      }
      b.disabled = false; b.textContent = t;
    };
  }
}

async function ttsBuffer(text, ctx) {
  const r = await fetch('/api/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: String(text || '').slice(0, 120) }),
  });
  if (!r.ok) throw new Error('配音失败 HTTP ' + r.status);
  return await ctx.decodeAudioData(await r.arrayBuffer());
}
async function makeFilmAI(onStep) {        // 用 GLM-TTS 当配音轨录一部真的能看的片子
  const step = typeof onStep === 'function' ? onStep : () => {};
  if (!G.panels.length) throw new Error('还没有分镜,先回第 5 步画画');
  if (!(window.MediaRecorder && document.createElement('canvas').captureStream)) throw new Error('这个浏览器不支持网页录像,请用 Edge 或 Chrome');
  const W = 1280, H = 800;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx2 = cv.getContext('2d');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !document.createElement('canvas').captureStream) throw new Error('这个浏览器不支持录音,请用 Edge 或 Chrome');
  const ac = new AC();
  const dest = ac.createMediaStreamDestination();
  await Promise.race([ac.resume ? ac.resume() : Promise.resolve(), new Promise(r => setTimeout(r, 500))]);
  step('① 请 GLM-TTS 配音(每页一句)…');
  const pages = [{ kind: 'cover', dur: 3.0, speak: (G.title || '我的电影') + '。导演' + G.director + '。' + (G.synopsis || synopsisText()) }]
    .concat(G.panels.map((p, i) => ({ kind: 'panel', dur: 3.2, cap: (p.cap || '').trim(), svg: p.svg, img: p.img, speak: (p.cap || '').trim() || ('第' + (i + 1) + '页'), idx: i })));
  const imgs = [], bufs = [];
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    step('① 配音 ' + (i + 1) + '/' + pages.length + '…');
    try { bufs.push(await ttsBuffer(pg.speak, ac)); } catch (e) { bufs.push(null); }
    if (pg.img) imgs.push(await imgOf(pg.img));
    else if (!pg.svg) imgs.push(null);
    else {
      const sized = pg.svg.replace('<svg ', '<svg width="640" height="400" ');
      imgs.push(await new Promise(res => {
        const im = new Image(); let done = false; const fin = v => { if (!done) { done = true; res(v); } };
        im.onload = () => fin(im); im.onerror = () => fin(null); setTimeout(() => fin(null), 3000);
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
      }));
    }
  }
  const stream = cv.captureStream(24);
  dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? { mimeType: 'video/webm;codecs=vp9,opus' } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = Date.now();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    step('② 录像中 ' + (i + 1) + '/' + pages.length + '…');
    const ab = bufs[i];
    const dur = Math.max(pg.dur * 1000, ab ? ab.duration * 1000 + 400 : 0);
    if (ab) { const src = ac.createBufferSource(); src.buffer = ab; src.connect(dest); src.connect(ac.destination); src.start(); }
    const s0 = Date.now();
    while (true) {
      const el = Date.now() - s0, prog = Math.min(1, el / dur);
      drawPage(ctx2, pg, imgs[i], prog, W, H);
      if (el >= dur) break;
      await sleep(40);
    }
  }
  await sleep(300);
  rec.stop(); await stopped;
  try { ac.close(); } catch (e) {}
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  G.videoUrl = url; G.filmMs = Date.now() - t0; G.videoModel = '本机录制 + ' + modelOf('tts') + ' 配音'; G.videoCost = 0;
  return { url, ms: G.filmMs, pages: pages.length, size: blob.size, blob };
}
const _imgCache = {};
function imgOf(src) {
  if (_imgCache[src]) return Promise.resolve(_imgCache[src]);
  return new Promise(res => {
    const im = new Image();
    let done = false; const fin = v => { if (!done) { done = true; if (v) _imgCache[src] = v; res(v); } };
    im.crossOrigin = 'anonymous';
    im.onload = () => fin(im); im.onerror = () => fin(null); setTimeout(() => fin(null), 6000);
    im.src = src;
  });
}

/* ============================================================
   挂到游戏上(不修改 game.js 主逻辑)
   ============================================================ */
const _renderIdea = renderIdea;
renderIdea = function () { _renderIdea.apply(this, arguments); ensureIdeaUI(); };
const _renderStory = renderStory;
renderStory = function () { _renderStory.apply(this, arguments); ensureStoryUI(); };
const _renderPanels = renderPanels;
renderPanels = function () { _renderPanels.apply(this, arguments); augmentPanels(); showAiImages(); };
const _renderPrem = renderPrem;
renderPrem = function () { _renderPrem.apply(this, arguments); ensurePremUI(); };
const _renderPlayer = renderPlayer;
renderPlayer = function () {
  _renderPlayer.apply(this, arguments);
  const box = $('#film-player');
  if (box && G.videoUrl && G.videoModel) {
    const s = box.querySelector('.smallmsg');
    if (s && !s.dataset.m) { s.dataset.m = '1'; s.innerHTML += '<br>🎥 这条片子:<b>' + esc(G.videoModel) + '</b>' + (G.videoCost ? '(约 ¥' + G.videoCost + ')' : '(免费)'); }
  }
};
document.addEventListener('click', e => {
  const pol = e.target.closest('.act-polish');
  if (pol) { aiPolish(pol.closest('.panel')); return; }
  const ap = e.target.closest('.act-aipaint');
  if (ap) { aiPaint(ap.closest('.panel')); return; }
  const go = e.target.closest('[data-go]');
  if (go && go.getAttribute('data-go') === 'sc-idea') setTimeout(autoSynopsis, 60);   // 进"讲想法"就自动写通顺
}, true);

bkBoot().then(() => { if (BK.ok && ready('synopsis')) setTimeout(autoSynopsis, 300); });
