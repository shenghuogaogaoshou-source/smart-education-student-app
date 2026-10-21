/* ============================================================
   脑洞放映厅 · 主逻辑(v3 槽位版 · 纯离线,不含任何 API 调用)
   六步:① 抽脑洞卡 → ② 讲想法 → ③ 写剧本 → ④ 定画风 → ⑤ 画分镜 → ⑥ 首映礼
   作品只存本机;影片用浏览器自带录制能力生成(不需要联网)
   ============================================================ */

/* ---------------- 全局状态 ---------------- */
const G = {
  stage: 'title',        // title / card / idea / story / style / board / prem
  director: '小导演', intern: '小映',
  slots: [], moving: null, dragFrom: null,             // [{key,name,emoji,required,custom,pool:[{t,e}],card:{t,e}|null}]
  idea: '', story: '', storyDraft: '', style: '', stylePicked: false,
  panels: [], filmIdx: 0, title: '', refl: ['', ''], statement: '',
  log: [], replayId: '', videoUrl: '', filmMs: 0,
  wrongOn: false, capWarned: false,
};

/* ---------------- 小工具 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const store = {
  _m: {},
  get(k) { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch (e) { return this._m[k]; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { this._m[k] = v; } },
};
let toastTimer = null;
function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2600);
}
function lg(kind, txt) {
  G.log.push({ t: new Date().toTimeString().slice(0, 5), kind, txt: String(txt).slice(0, 80) });
  if (G.log.length > 200) G.log.shift();
}

/* ---------------- 步骤条与屏幕 ---------------- */
const internName = () => ((G && G.intern) || '小映');
const STEPS = { card: 1, idea: 2, story: 3, style: 4, board: 5, prem: 6 };
function screenId(stage) { return 'sc-' + stage; }
function show(stage) {
  G.stage = stage;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === screenId(stage)));
  refreshStepbar();
  syncDownstreamNotes();
  saveDraft();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function refreshStepbar() {
  const bar = $('#stepbar');
  if (bar) bar.classList.toggle('hidden', G.stage === 'title');   /* 首页不显示步骤条 */
  $$('#stepbar .step').forEach(el => {
    const n = +el.getAttribute('data-step');
    const cur = STEPS[G.stage] || 0;
    el.classList.toggle('cur', n === cur);
    el.classList.toggle('now', n === cur);
    el.classList.toggle('done', n < cur);
    const reachable = stepHasContent(n);
    el.classList.toggle('locked', !reachable);
    el.style.cursor = reachable ? 'pointer' : 'default';
    el.title = reachable ? '点这里跳到第 ' + n + ' 步' : '这一步还没内容';
  });
}
function stepHasContent(n) {
  if (n === 1) return true;
  if (n === 2) return requiredCardsDone();
  if (n === 3) return !!(G.story || '').trim();
  if (n === 4) return !!G.style;
  if (n === 5) return G.panels.length > 0;
  if (n === 6) return G.panels.length > 0;
  return false;
}
function jumpTo(n) {
  if (!stepHasContent(n)) { toast('这一步还没有内容,先按顺序来'); return; }
  const map = { 1: 'card', 2: 'idea', 3: 'story', 4: 'style', 5: 'board', 6: 'prem' };
  const st = map[n];
  if (n === 2) renderIdea();
  if (n === 3) renderStory();
  if (n === 4) renderStyle();
  if (n === 5) { if (!G.panels.length) initPanels(); renderBoard(); }
  if (n === 6) { G.filmIdx = 0; renderPrem(); }
  show(st);
  toast('已跳到第 ' + n + ' 步:后面的内容都给你留着');
}
const STALE_MSG = {
  story: '你改了想法或卡片,下面这份剧本还是旧的——要重写就点「重新整理草稿」,不想改就接着用。',
  prem: '你改了前面的内容,分镜和影片还是旧的——想同步就回第 5 步重画,不想改就接着用。',
};
function syncDownstreamNotes() {
  const a = $('#stale-story'), b = $('#stale-prem');
  if (a) { const on = !!(G.story) && G.storyStale; a.textContent = on ? '⚠️ ' + STALE_MSG.story : ''; a.classList.toggle('hidden', !on); }
  if (b) { const on = G.panels.length && G.panelsStale; b.textContent = on ? '⚠️ ' + STALE_MSG.prem : ''; b.classList.toggle('hidden', !on); }
}

/* ---------------- 位置 1:抽脑洞卡 ---------------- */
function myCards() {                     /* 孩子自己写的卡:{ key: [{t,e}] } */
  const m = store.get('bh_mycards');
  return (m && typeof m === 'object') ? m : {};
}
function saveMyCards(m) { store.set('bh_mycards', m); }
function myCount(s) {
  return s.pool.filter(c => c.mine).length;
}
function initSlots() {
  const mine = myCards();
  G.slots = SLOT_DEFS.map(d => {
    const pool = d.cards.slice();
    (mine[d.key] || []).forEach(c => { if (!pool.some(x => x.t === c.t)) pool.push({ t: c.t, e: c.e, mine: true }); });
    return {
      key: d.key, name: d.name, emoji: d.emoji, required: !!d.required,
      custom: false, pool, card: null, hint: d.hint,
    };
  });
  G.customSeq = 0;
}
function requiredCardsDone() {
  return G.slots.filter(s => s.required).every(s => s.card);
}
function renderSlots() {
  const grid = $('#slot-grid');
  const moving = (typeof G.moving === 'number' && G.moving !== null) ? G.moving : null;
  grid.innerHTML = G.slots.map((s, i) => {
    const card = s.card;
    /* 正在"换格":别的格子显示一个"换到这里" */
    const moveTo = (moving !== null && i !== moving)
      ? `<button class="btn btn-mini slot-swap" data-act="movehere" title="和「${esc(G.slots[moving].name)}」换">↔ 换到这里</button>`
      : (moving === i ? `<span class="slot-moving">🔀 选一个格子换过去…</span>` : '');
    return `<article class="slotcard ${card ? 'has' : ''} ${s.required ? 'req' : ''} ${moving === i ? 'moving' : ''}" data-i="${i}">
      <div class="slot-head">
        <span class="slot-name">${s.emoji} ${esc(s.name)}</span>
        <span class="slot-tags">
          ${s.required ? '<i class="reqtag">必抽</i>' : '<i class="opttag">可选</i>'}
          ${s.custom ? `<button class="btn btn-mini slot-del" data-act="delslot" title="删掉这个格子">✖</button>` : ''}
        </span>
      </div>
      <div class="slot-card"${card ? ' draggable="true" title="按住这张卡拖到别的格子,就能换位置"' : ''}>
        ${card ? `<span class="slot-emoji">${card.e}</span><b>${esc(card.t)}</b>` : `<span class="slot-empty">${esc(s.hint || '还没抽卡')}</span>`}
        ${(!s.required && card) ? `<button class="slot-x" data-act="clearcard" title="不要这张卡">✖</button>` : ''}
      </div>
      <div class="slot-acts">
        <button class="btn btn-mini" data-act="draw">${card ? '🔄 换一张' : '🎲 抽一张'}</button>
        <button class="btn btn-mini" data-act="write">✏️ 自己写</button>
      </div>
      <div class="slot-acts2">
        ${card ? `<button class="btn btn-mini" data-act="move" title="不用拖动也能换:点这里,再点目标格子">🔀</button>` : ''}
        <button class="btn btn-mini" data-act="left" title="这个格子往前挪" ${i === 0 ? 'disabled' : ''}>◀</button>
        <button class="btn btn-mini" data-act="right" title="这个格子往后挪" ${i === G.slots.length - 1 ? 'disabled' : ''}>▶</button>
        ${moveTo}
      </div>
      <div class="slot-pool">卡池 ${s.pool.length} 张${myCount(s) ? '(你加了 ' + myCount(s) + ' 张)' : ''}</div>
    </article>`;
  }).join('');
}
function drawSlot(i) {
  const s = G.slots[i];
  if (!s.pool || !s.pool.length) { toast('这个格子还没有卡池,点「✏️ 自己写」给自己写一张吧'); return; }
  let c = pick(s.pool), tries = 0;
  while (s.card && c.t === s.card.t && tries++ < 8) c = pick(s.pool);
  s.card = { t: c.t, e: c.e };
  lg('card', '抽到「' + s.name + '」:' + c.t);
  renderSlots(); saveDraft();
}
function writeSlot(i) {
  const s = G.slots[i];
  const t = prompt('给「' + s.name + '」写一张卡(不超过 16 个字,会存进卡池,以后还能抽到)', s.card ? s.card.t : '');
  if (t === null) return;
  const v = String(t).trim().slice(0, 16);
  if (!v) { toast('什么都没写哦'); return; }
  let mine = false;
  if (!s.pool.some(c => c.t === v)) {              /* 自己的卡进池子,以后还能被抽到 */
    s.pool.push({ t: v, e: s.emoji, mine: true });
    mine = true;
    if (!s.custom) {
      const all = myCards();
      all[s.key] = all[s.key] || [];
      if (!all[s.key].some(c => c.t === v)) all[s.key].push({ t: v, e: s.emoji });
      saveMyCards(all);
    }
  }
  s.card = { t: v, e: s.emoji };
  lg('card', '自己写了「' + s.name + '」:' + v);
  toast(mine ? '✅ 已用上,并存进「' + s.name + '」的卡池(现在 ' + s.pool.length + ' 张)' : '✅ 用上了');
  renderSlots(); saveDraft();
}
function clearSlotCard(i) {                  /* 可选格:这张卡不要了 */
  const s = G.slots[i];
  if (s.required) { toast('主角、场景、经过是必抽的,不能空着——可以「换一张」'); return; }
  if (!s.card) return;
  lg('card', '把「' + s.name + '」的卡拿掉了:' + s.card.t);
  s.card = null;
  renderSlots(); saveDraft();
  toast('已拿掉这张卡(卡池里还在,想用再抽回来)');
}
function swapCards(a, b) {                   /* 两张卡换位置 */
  if (a === b) return;
  const A = G.slots[a], B = G.slots[b];
  const t = A.card; A.card = B.card; B.card = t;
  G.moving = null; G.dragFrom = null;
  lg('card', '「' + A.name + '」和「' + B.name + '」的卡换了个位置');
  renderSlots(); saveDraft();
  toast('🔀 换好了:' + A.name + ' = ' + (A.card ? A.card.t : '(空)') + ', ' + B.name + ' = ' + (B.card ? B.card.t : '(空)'));
}
function moveSlot(i, dir) {                  /* 格子本身左右挪(含自己加的格子) */
  const j = i + dir;
  if (j < 0 || j >= G.slots.length) return;
  const t = G.slots[i]; G.slots[i] = G.slots[j]; G.slots[j] = t;
  lg('card', '把「' + G.slots[j].name + '」' + (dir < 0 ? '往前' : '往后') + '挪了一格');
  renderSlots(); saveDraft();
}
function addSlot() {
  const name = prompt('新格子叫什么?(比如:宝物 / 天气 / 一句话)');
  if (name === null) return;
  const v = String(name).trim().slice(0, 8);
  if (!v) { toast('没填名字'); return; }
  if (G.slots.some(s => s.name === v)) { toast('已经有这个格子了'); return; }
  G.slots.push({ key: 'custom' + (++G.customSeq || 1), name: v, emoji: '🧩', required: false, custom: true, pool: [], card: null, hint: '抽不到就自己写' });
  lg('card', '加了一个新格子:' + v);
  renderSlots(); saveDraft();
}
function drawAll() {
  G.slots.forEach((s, i) => { if (!s.card) drawSlot(i); });
  toast('全部抽好了!缺哪格点「换一张」');
}
function clearAll() {
  if (!confirm('把所有格子都清空重抽?')) return;
  G.slots.forEach(s => { s.card = null; });
  renderSlots(); saveDraft();
}

/* ---------------- 位置 2:讲想法 ---------------- */
function cardOf(key) { const s = G.slots.find(x => x.key === key); return s && s.card ? s.card.t : ''; }
function synopsisText() {
  const hero = cardOf('hero') || '(还没抽主角)', scene = cardOf('scene') || '(还没抽场景)', plot = cardOf('plot') || '(还没抽经过)';
  const side = cardOf('side'), turn = cardOf('turn'), other = cardOf('other');
  let s = '有一个' + hero + ',住在' + scene + '。有一天,' + hero + plot + '。';
  if (side) s += '好在' + side + '一直陪着它。';
  if (other) s += '它们还带上了' + other + '。';
  if (turn) s += '可是没想到,' + turn + '。';
  const more = G.slots.filter(x => x.custom && x.card).map(x => x.name + '是' + x.card.t);
  if (more.length) s += '对了,' + more.join('、') + '。';
  return s;
}
function renderIdea() {
  const syn = G.synopsis || synopsisText();
  $('#idea-synopsis').textContent = syn;
  if (G.synopsis) $('#idea-synopsis').classList.add('ai-syn');
  $('#ta-idea').value = G.idea || '';
  const tag = $('#idea-syn-tag');
  if (tag) tag.textContent = G.synopsis ? ('✍️ AI 写的 · 可点「🔁 换一版」') : '程序先拼了一版——点「✨ 让 AI 把简介写通顺」';
}
function ideaToStoryDraft() {
  const syn = synopsisText();
  const detail = ($('#ta-idea').value || '').trim();
  G.idea = detail;
  const parts = [];
  parts.push(syn);
  if (detail) {
    /* 离线:把导演补充的话按句子切开,一行一页,一个字都不编 */
    const sentences = detail.split(/(?<=[。！?;;\n])/).map(x => x.replace(/^[\s,，、]+/, '').trim()).filter(Boolean);
    sentences.forEach(s2 => parts.push(s2));
  }
  G.storyDraft = parts.join('\n');
  G.story = G.storyDraft;
  lg('story', '整理出剧本草稿:' + parts.length + ' 行');
  return parts;
}
function renderStory() {
  $('#ta-story').value = G.story || G.storyDraft || '';
  $('#bub-story').innerHTML = '🤖 ' + esc(G.intern) + ':这是我照着你的简介和补充写的剧本草稿——<b>每一行就是一页分镜</b>,不满意直接改,你才是导演。' +
    '<br><small>现在是离线草稿模式:只按你说的顺序整理,没有替你编情节。接入写剧本的大模型后,这里会变成真正连贯的剧本。</small>';
  $('#story-hint').textContent = (G.story || '').split('\n').filter(Boolean).length + ' 页';
}

/* ---------------- 位置 4:定画风 ---------------- */
function renderStyle() {
  const text = (G.synopsis || synopsisText()) + ' ' + (G.idea || '') + ' ' + (G.story || '');
  const recos = recommendStyles(text, 6);          /* 第 1 个最推荐 + 后面 5 个备选 */
  const best = recos[0] || { name: '儿童绘本', e: '🎨', desc: '' };
  const others = recos.slice(1, 6);
  const bub = $('#style-bubble');
  if (bub) bub.innerHTML = '🤖 ' + esc(internName()) + ':我看了一遍你的故事,先挑了一个最搭的;不喜欢就换下面的,或者自己写一种。';
  const why = (best.hit && best.hit.length)
    ? '你的故事里有「' + best.hit.slice(0, 3).join('、') + '」,和它最搭'
    : '和你这个故事的气质最搭';
  $('#style-recos').innerHTML =
    '<article class="pickbest' + (G.style === best.name ? ' sel' : '') + '" data-style="' + esc(best.name) + '" data-act="usepick">' +
      '<div class="pb-emoji">' + best.e + '</div>' +
      '<div class="pb-body">' +
        '<div class="pb-tag">⭐ AI 最推荐</div>' +
        '<div class="pb-name">' + esc(best.name) + '</div>' +
        '<div class="pb-desc">' + esc(best.desc || '') + '</div>' +
        '<div class="pb-why">' + esc(why) + '</div>' +
      '</div>' +
      '<div class="pb-go">' + (G.style === best.name ? '✅ 已选中' : '就用它 →') + '</div>' +
    '</article>' +
    '<div class="pickrow">' + others.map(r =>
      '<button class="pickmini' + (G.style === r.name ? ' sel' : '') + '" data-style="' + esc(r.name) + '" data-act="usepick" title="' + esc(r.desc || '') + '">' +
        '<span class="pm-emoji">' + r.e + '</span><span class="pm-name">' + esc(r.name) + '</span>' +
      '</button>').join('') + '</div>';
  $('#in-style-custom').value = G.stylePicked && !recos.some(r => r.name === G.style) ? G.style : '';
  const msg = $('#style-msg');
  if (msg) msg.textContent = G.style ? ('✅ 就用「' + G.style + '」来画,可以点「开始画分镜」了') : '选一个你喜欢的(点一下就行),或者自己写一种。';
  $('#btn-style2board').disabled = !G.style;
}
function chooseStyle(name) {
  G.style = String(name || '').trim().slice(0, 20);
  G.stylePicked = true;
  lg('style', '定了画风:' + G.style);
  toast('🎨 画风定为「' + G.style + '」');
  G.panels = []; G.panelsStale = false;      // 换画风 → 分镜要重画(但草稿仍保留剧本)
  renderStyle(); saveDraft();
}

/* ---------------- 位置 5:画分镜 ---------------- */
function initPanels() {
  const lines = (G.story || '').split('\n').map(x => x.trim()).filter(Boolean);
  const caps = lines.length ? lines : ['(还没有剧本)'];
  const same = G.panels.length === caps.length && G.panels.every((p, i) => (p.cap || '') === caps[i]);
  if (same) return;                     /* 剧本没改 → 保留孩子已经画好的东西 */
  G.panels = caps.map((cap, i) => ({
    cap, prm: '', seed: (i + 1) * 977, version: 0, wrong: null, note: '', fix: '',
    accepted: false, svg: '', img: '', aiMsg: '', aiDrawn: false,
  }));
  lg('panel', '生成了 ' + G.panels.length + ' 页分镜(等孩子来画)');
}
/* 画风 → 调色 */
function paletteFor(text) {
  const t = (text || '') + ' ' + (G.style || '');
  const rules = [
    { kw: ['海底', '深', '水', '游', '鲸', '海'], bg: ['#0e5aa7', '#1d8ac9'], deco: 'bubbles' },
    { kw: ['云', '天', '飞', '风', '雨'], bg: ['#7ec8f7', '#e8f6ff'], deco: 'cloud' },
    { kw: ['太空', '宇宙', '星', '月', '夜', '霓虹'], bg: ['#171240', '#3a2a7a'], deco: 'stars' },
    { kw: ['森林', '树', '花', '草', '园'], bg: ['#7fd18a', '#e4f7d3'], deco: 'leaves' },
    { kw: ['雪', '冰', '冬', '冷'], bg: ['#dfeffa', '#f6fbff'], deco: 'snow' },
    { kw: ['沙漠', '沙', '黄'], bg: ['#f2c464', '#fde7b2'], deco: 'sun' },
    { kw: ['火', '热', '红'], bg: ['#f79b72', '#ffe0c2'], deco: 'sparkle' },
    { kw: ['纸', '信', '旧', '书'], bg: ['#f6e7c8', '#fffaf0'], deco: 'sparkle' },
  ];
  for (const r of rules) if (r.kw.some(k => t.includes(k))) return r;
  return { bg: ['#c9b6ff', '#f3ecff'], deco: 'sparkle' };
}
function emojisOf() {
  const out = [];
  G.slots.forEach(s => { if (s.card) out.push(s.card.e); });
  return out.length ? out : ['🎬'];
}
function buildSVG(p, i) {
  const pal = paletteFor(p.cap + ' ' + p.prm);
  const [c1, c2] = pal.bg;
  const es = emojisOf();
  const main = es[0] || '🎬', second = es[1] || '', third = es[2] || '';
  const wrong = !!p.wrong;
  const deco = pal.deco || 'sparkle';
  const decoHtml = {
    bubbles: '<circle cx="120" cy="120" r="16" fill="#fff" opacity=".35"/><circle cx="480" cy="90" r="22" fill="#fff" opacity=".28"/><circle cx="560" cy="300" r="14" fill="#fff" opacity=".3"/>',
    cloud: '<ellipse cx="200" cy="100" rx="70" ry="34" fill="#fff" opacity=".6"/><ellipse cx="520" cy="140" rx="56" ry="28" fill="#fff" opacity=".5"/>',
    stars: '<circle cx="120" cy="90" r="4" fill="#fff"/><circle cx="500" cy="70" r="5" fill="#fff"/><circle cx="300" cy="60" r="3" fill="#fff"/><circle cx="580" cy="180" r="4" fill="#fff"/>',
    leaves: '<path d="M100 320 q30 -50 60 0 q-30 20 -60 0" fill="#2f9e44" opacity=".55"/><path d="M520 300 q28 -46 56 0 q-28 18 -56 0" fill="#2f9e44" opacity=".45"/>',
    snow: '<circle cx="140" cy="110" r="6" fill="#fff"/><circle cx="420" cy="80" r="5" fill="#fff"/><circle cx="540" cy="250" r="7" fill="#fff"/>',
    sun: '<circle cx="530" cy="90" r="42" fill="#ffe066" opacity=".9"/>',
    sparkle: '<path d="M540 120 l10 24 l24 10 l-24 10 l-10 24 l-10 -24 l-24 -10 l24 -10 z" fill="#fff" opacity=".7"/>',
  }[deco] || '';
  const wrongBadge = wrong ? `<g><rect x="24" y="24" rx="14" width="250" height="52" fill="#e17055" opacity=".92"/><text x="46" y="58" font-size="26" fill="#fff" font-family="sans-serif">💥 画错啦!(v${p.version})</text></g>` : '';
  const styleTag = `<text x="612" y="378" text-anchor="end" font-size="20" fill="#ffffff" opacity=".85" font-family="sans-serif">${esc(G.style || '')} · v${p.version}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" style="width:100%;height:100%;display:block">
    <defs><linearGradient id="sky${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="640" height="400" fill="url(#sky${i})"/>
    ${decoHtml}
    <text x="320" y="215" text-anchor="middle" font-size="150">${wrong ? '❓' : main}</text>
    <text x="105" y="235" text-anchor="middle" font-size="70">${second}</text>
    <text x="540" y="235" text-anchor="middle" font-size="70">${third}</text>
    <text x="320" y="330" text-anchor="middle" font-size="24" fill="#ffffff" opacity=".92" font-family="sans-serif">${esc(p.cap || '').slice(0, 22)}</text>
    ${styleTag}${wrongBadge}
  </svg>`;
}
/* 离线画师:提示词太糊 → "翻车"(教学点:AI 会一本正经地理解错) */
function paintPanel(p, i) {
  p.version++;
  const prm = (p.prm || '').trim();
  const vague = prm.length > 0 && prm.length < 6;
  const empty = !prm;
  p.wrong = null; p.note = ''; p.fix = '';
  if (G.wrongOn && (empty || vague) && !p.accepted) {
    /* 教学点:提示词说不清,小映一定会理解偏(不随机,孩子才能学会"改提示词→画对") */
    p.wrong = empty ? '提示词是空的,' + internName() + '只能瞎猜' : '提示词太短,' + internName() + '理解偏了';
    p.note = '我把「' + (p.cap || '').slice(0, 12) + '」画成了别的东西……';
    p.fix = '在下面的提示词里写清楚:画面里有谁、在哪里、在做什么(写具体了就不会画错)';
  } else if (G.wrongOn && !empty) {
    p.note = internName() + ':这次明白多了!';
  }
  p.svg = buildSVG(p, i);
  return p.svg;
}
function renderBoard() {
  const tip = $('#board-tip');
  const nm = internName();
tip.innerHTML = '<b>💡 分镜台口诀:</b>每一格 = 台词 + 给' + nm + '的"画面提示词"。' +
    '<br><span style="color:#8b7fb8">画得不满意?那是提示词没说清——写清"谁/在哪/在做什么",再点「🖼️ AI 画这格」。</span>' +
    '<br><span style="color:#8b7fb8">本片画风:</span> <b>' + esc(G.style || '(未定)') + '</b>';
  renderPanels();
}
function renderPanels() {
  $('#panel-grid').innerHTML = G.panels.map((p, i) => {
    const hasArt = !!(p.img || p.svg);
    const chip = !hasArt ? '<span class="pchip wait">✏️ 等你创作</span>'
      : p.img ? '<span class="pchip ok">🎨 AI 画的</span>'
        : p.wrong ? '<span class="pchip wrong">⚠️ 画错啦</span>'
          : p.accepted ? '<span class="pchip ok">✅ 已通过 v' + p.version + '</span>'
            : '<span class="pchip">🖌️ v' + p.version + '</span>';
    const art = hasArt
      ? '<div class="svgbox">' + (p.svg || '') + '</div>'
      : '<div class="svgbox empty">' +
          '<div class="empty-emoji">🎬</div>' +
          '<div class="empty-text">等待你创作</div>' +
          '<div class="empty-sub">写一句画面提示词,再点「🖼️ AI 画这格」</div>' +
        '</div>';
    const note = (p.wrong || p.note) ? '<div class="boardtip">🤖 ' + esc(internName()) + ':' + esc(p.note || p.wrong) + (p.fix ? '<br><b>💡 ' + esc(p.fix) + '</b>' : '') + '</div>' : '';
    return '<article class="panel" data-i="' + i + '">' +
      '<div class="panel-head"><span class="panel-num">🎞️ 第 ' + (i + 1) + ' 格</span>' + chip + '</div>' +
      art + note +
      '<label>📝 这一页的台词 / 旁白</label>' +
      '<textarea class="cap" rows="2" maxlength="120" placeholder="这一格发生了什么事?">' + esc(p.cap) + '</textarea>' +
      '<label>🎨 画面提示词(写清谁、在哪、在做什么)</label>' +
      '<textarea class="prm" rows="2" placeholder="例:圆滚滚的蓝色小鲸鱼在海底理发店门口,水泡慢慢上浮">' + esc(p.prm || '') + '</textarea>' +
      '<div class="panel-actions">' +
        '<button class="btn btn-mini act-polish">✨ 帮我把提示词写具体</button>' +
        '<button class="btn btn-mini act-aipaint">🖼️ AI 画这格</button>' +
        '<button class="btn btn-mini act-accept' + (p.accepted ? ' btn-primary' : '') + '">' + (p.accepted ? '✅ 已通过(点此撤回)' : '✅ 这版通过') + '</button>' +
        '<button class="btn btn-mini act-paint">🎨 重画这格</button>' +
      '</div>' +
    '</article>';
  }).join('');
}
function addPanel() {
  if (G.panels.length >= 10) { toast('最多 10 格,够啦!'); return; }
  G.panels.push({ cap: '', prm: '', seed: rnd(9999), version: 0, wrong: null, note: '', fix: '', accepted: false, svg: '', img: '', aiMsg: '' });
  renderPanels();
}
function delPanel() { if (G.panels.length <= 2) { toast('至少留 2 格'); return; } G.panels.pop(); renderPanels(); }

/* ---------------- 位置 6:首映礼 ---------------- */
function renderPrem() {
  if (!$('#in-title').value && G.title) $('#in-title').value = G.title;
  $('#ta-r1').value = G.refl[0] || '';
  $('#ta-r2').value = G.refl[1] || '';
  $('#ta-statement').value = G.statement || '';
  G.filmIdx = Math.min(G.filmIdx, G.panels.length);
  renderFilm();
  renderPlayer();
  renderLog();
}
function pageCover() {
  return `<div class="page page-cover">
    <div class="cv-emoji">🎬</div>
    <div class="cv-title">《${esc(G.title || '还没起名字')}》</div>
    <div class="cv-meta">导演 ${esc(G.director)} · AI 实习生 ${esc(G.intern)}<br>${esc(synopsisText())}</div>
    <div class="cv-meta">画风:${esc(G.style || '')}</div>
  </div>`;
}
function pagePanel(p, i) {
  return `<div class="page">
    <div class="svgbox">${p.svg}</div>
    <div class="page-caption">🎞️ 第 ${i + 1} 页 · ${esc(p.cap || '……')}</div>
  </div>`;
}
function renderFilm() {
  const film = $('#film');
  if (!film) return;
  film.innerHTML = [pageCover()].concat(G.panels.map(pagePanel)).join('');
  const all = film.children;
  for (let i = 0; i < all.length; i++) all[i].style.display = i === G.filmIdx ? 'flex' : 'none';
  const pos = $('#film-pos'); if (pos) pos.textContent = (G.filmIdx + 1) + ' / ' + all.length;
  renderStrip();
}
function renderStrip() {
  const strip = $('#filmstrip'); if (!strip) return;
  strip.innerHTML = `<div class="thumb${G.filmIdx === 0 ? ' cur' : ''}" data-fi="0"><div style="font-size:28px;text-align:center;padding:10px 0">🎬</div></div>` +
    G.panels.map((p, i) => `<div class="thumb${G.filmIdx === i + 1 ? ' cur' : ''}" data-fi="${i + 1}">${p.svg}</div>`).join('');
}
function renderLog() {
  const el = $('#log-list'); if (!el) return;
  el.innerHTML = G.log.slice(-60).map(e => `<div><span class="lg-t">${esc(e.t)}</span>${esc(e.txt)}</div>`).join('') ||
    '<div style="color:#b3a6dd">还没有记录。</div>';
}
function renderPlayer() {
  const box = $('#film-player'); if (!box) return;
  if (!G.videoUrl) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `<video src="${esc(G.videoUrl)}" controls autoplay playsinline
      style="width:100%;border-radius:14px;border:2.5px solid #e8def6;background:#000"></video>
    <div class="smallmsg">🎥 这就是你的片子(${Math.round((G.filmMs || 0) / 1000)} 秒):剧本 + 每一页分镜 + 台词字幕。
    <a href="${esc(G.videoUrl)}" download="《${esc(G.title || '我的电影')}》.webm">下载这段影片</a></div>`;
}
/* 用浏览器自带的录制能力,把剧本 + 分镜连成一段真影片(不需要联网/不需要 API) */
async function makeFilm(onStep) {
  const step = typeof onStep === 'function' ? onStep : () => {};
  if (!G.panels.length) throw new Error('还没有分镜,先回第 5 步画画');
  if (!(window.MediaRecorder && document.createElement('canvas').captureStream)) {
    throw new Error('这个浏览器不支持网页录像,请用 Edge 或 Chrome 打开');
  }
  const W = 1280, H = 800;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  step('① 正在准备画面…');
  const pages = [{ kind: 'cover', dur: 2.6, speak: G.title + '。导演' + G.director + '。' + synopsisText() }]
    .concat(G.panels.map((p, i) => ({ kind: 'panel', dur: 3.2, cap: (p.cap || '').trim(), svg: p.svg, speak: (p.cap || '').trim(), idx: i })));
  const imgs = [];
  for (const pg of pages) {
    if (!pg.svg) { imgs.push(null); continue; }
    const sized = pg.svg.replace('<svg ', '<svg width="640" height="400" ');
    imgs.push(await new Promise(res => {
      const im = new Image();
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      im.onload = () => fin(im); im.onerror = () => fin(null);
      setTimeout(() => fin(null), 3000);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    }));
  }
  /* 浏览器朗读当配音轨(免费);不支持就录成无声 */
  let audioCtx = null, dest = null, bufs = [];
  try {
    if (window.speechSynthesis) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && AC.prototype.createMediaStreamDestination) {
        audioCtx = new AC(); dest = audioCtx.createMediaStreamDestination();
        await Promise.race([audioCtx.resume ? audioCtx.resume() : Promise.resolve(), new Promise(r => setTimeout(r, 400))]);
        bufs = pages.map(() => null);
      }
    }
  } catch (e) { audioCtx = null; dest = null; }
  const stream = cv.captureStream(24);
  if (dest && dest.stream.getAudioTracks) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? { mimeType: 'video/webm;codecs=vp9,opus' } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = Date.now();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    step('② 正在录第 ' + (i + 1) + '/' + pages.length + ' 页…');
    if (dest && pg.speak && window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance(pg.speak);
        u.lang = 'zh-CN'; u.rate = 0.95;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
    const dur = pg.dur * 1000;
    const s0 = Date.now();
    while (true) {
      const el = Date.now() - s0, prog = Math.min(1, el / dur);
      drawPage(ctx, pg, imgs[i], prog, W, H);
      if (el >= dur) break;
      await sleep(40);
    }
  }
  await sleep(200);
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  rec.stop(); await stopped;
  if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  G.videoUrl = url; G.filmMs = Date.now() - t0;
  return { url, ms: G.filmMs, pages: pages.length, size: blob.size, blob };
}
function drawPage(ctx, pg, img, prog, W, H) {
  ctx.save();
  if (pg.kind === 'cover') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6c5ce7'); g.addColorStop(1, '#14121f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '700 60px "Microsoft YaHei", sans-serif';
    ctx.fillText('《' + (G.title || '我的电影') + '》', W / 2, 330);
    ctx.font = '700 28px "Microsoft YaHei", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText('导演 ' + G.director + ' · AI 实习生 ' + G.intern, W / 2, 395);
    ctx.fillText(G.style ? ('画风:' + G.style) : '', W / 2, 440);
  } else {
    ctx.fillStyle = '#12101c'; ctx.fillRect(0, 0, W, H);
    if (img) { const z = 1 + 0.05 * prog; ctx.drawImage(img, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z); }
    const grad = ctx.createLinearGradient(0, H - 170, 0, H);
    grad.addColorStop(0, 'rgba(10,8,18,0)'); grad.addColorStop(1, 'rgba(10,8,18,.88)');
    ctx.fillStyle = grad; ctx.fillRect(0, H - 170, W, 170);
    if (pg.cap) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '700 32px "Microsoft YaHei", sans-serif';
      ctx.fillText(pg.cap.length > 26 ? pg.cap.slice(0, 26) + '…' : pg.cap, W / 2, H - 56);
    }
  }
  ctx.restore();
}

/* ---------------- 朗读(浏览器自带,免费) ---------------- */
let VOICE = { on: false, ok: !!(window.speechSynthesis) };
function speak(text) {
  if (!VOICE.on || !VOICE.ok || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 200));
    u.lang = 'zh-CN'; u.rate = 0.95;
    const vs = window.speechSynthesis.getVoices() || [];
    const v = vs.find(x => /zh|Chinese/i.test(x.lang + x.name));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} }
function speakPage() {
  if (!VOICE.on) return;
  if (G.filmIdx === 0) speak('《' + (G.title || '我的电影') + '》' + synopsisText());
  else { const p = G.panels[G.filmIdx - 1]; speak((p && p.cap) || '这一页没有台词'); }
}
function syncVoiceBtn() { const b = $('#btn-voice'); if (b) b.textContent = VOICE.on ? '🔊 朗读开' : '🔇 朗读关'; }
function goPage(i) {
  const max = G.panels.length;
  G.filmIdx = Math.max(0, Math.min(max, i));
  renderFilm(); stopSpeak(); speakPage();
}

/* ---------------- 存档 / 作品库 ---------------- */
function filmItem(id) {
  G.title = ($('#in-title') && $('#in-title').value || G.title || '').trim().slice(0, 24);
  G.refl = [($('#ta-r1') || {}).value || '', ($('#ta-r2') || {}).value || ''];
  G.statement = ($('#ta-statement') || {}).value || '';
  return {
    id: id || G.replayId || ('f' + Date.now()),
    savedAt: new Date().toISOString(),
    director: G.director, intern: G.intern,
    cards: G.slots.filter(s => s.card).map(s => ({ slot: s.name, card: s.card.t, emoji: s.card.e })),
    synopsis: synopsisText(), idea: G.idea, story: G.story, style: G.style,
    title: G.title, refl: G.refl, statement: G.statement,
    panels: G.panels.map(p => ({ cap: p.cap, prm: p.prm, svg: p.svg })),
    log: G.log.slice(-40), filmMs: G.filmMs || 0,
  };
}
function saveFilm() {
  const item = filmItem();
  let list = store.get('bh_archive') || [];
  list = list.filter(x => x.id !== item.id);
  list.unshift(item);
  if (list.length > 24) list = list.slice(0, 24);
  store.set('bh_archive', list);
  G.replayId = item.id;
  clearDraft();
  renderArchive();
  toast('🎉 已装订进作品库!去首页「我的作品库」可以再看、再打印。');
}
function renderArchive() {
  const list = store.get('bh_archive') || [];
  const cnt = $('#arch-count'); if (cnt) cnt.textContent = list.length;
  const wrap = $('#arch-list'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<p style="text-align:center;color:#8b7fb8">还没有作品,拍一部就有了!</p>'; return; }
  wrap.innerHTML = list.map(x => `<div class="arch-item" data-id="${esc(x.id)}">
      <div class="arch-thumb">${(x.panels[0] || {}).svg || '🎬'}</div>
      <div class="arch-info"><b>《${esc(x.title || '无题')}》</b>
        <div class="smallmsg">${esc(x.style || '')} · ${x.panels.length} 页 · ${esc((x.savedAt || '').slice(0, 10))}</div></div>
      <div class="arch-acts">
        <button class="btn btn-mini" data-act="replay">▶️ 重看</button>
        <button class="btn btn-mini" data-act="export">⬇️ 导出</button>
        <button class="btn btn-mini" data-act="print">🖨️ 打印</button>
        <button class="btn btn-mini" data-act="del">🗑</button>
      </div>
    </div>`).join('');
}
function openArchiveItem(id) {
  const list = store.get('bh_archive') || [];
  const it = list.find(x => x.id === id);
  if (!it) return;
  G.replayId = it.id;
  G.director = it.director || '小导演'; G.intern = it.intern || '小映';
  G.slots = (it.cards || []).map((c, i) => ({ key: 'a' + i, name: c.slot, emoji: c.emoji || '🎬', required: false, custom: false, pool: [], card: { t: c.card, e: c.emoji || '🎬' } }));
  G.idea = it.idea || ''; G.story = it.story || ''; G.style = it.style || '';
  G.title = it.title || ''; G.refl = [it.refl[0] || '', it.refl[1] || '']; G.statement = it.statement || '';
  G.panels = (it.panels || []).map(p => ({ cap: p.cap, prm: p.prm, svg: p.svg, version: 1, accepted: true, wrong: null, note: '', fix: '' }));
  G.log = it.log || []; G.filmIdx = 0;
  show('prem'); renderPrem();
  toast('▶️ 正在重看《' + (G.title || '无题') + '》');
}
function downloadText(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function printFilm(item) {
  const it = item || filmItem();
  const pages = it.panels.map((p, i) => `<div class="print-sheet">
      <div class="svgbox">${p.svg}</div>
      <div class="print-page-caption">第 ${i + 1} 页 · ${esc(p.cap || '')}${p.prm ? '<br><small>画面提示词:' + esc(p.prm) + '</small>' : ''}</div>
    </div>`).join('');
  $('#printRoot').innerHTML = `<div class="print-title">《${esc(it.title || '我的电影')}》</div>
    <div class="print-sub">导演 ${esc(it.director)} · AI 实习生 ${esc(it.intern)} · 画风 ${esc(it.style || '')}<br>${esc(it.synopsis || '')}</div>
    ${pages}
    <div class="print-sub"><b>导演评论:</b><br>① 最满意的一幕:${esc(it.refl[0] || '(未填)')}<br>② 还想改的地方:${esc(it.refl[1] || '(未填)')}<br>${it.statement ? '🎤 ' + esc(it.statement) : ''}</div>
    <div class="print-sub"><b>创作过程:</b><br>${it.log.slice(-18).map(e => '· ' + esc(e.txt)).join('<br>')}</div>`;
  window.print();
}

/* ---------------- 草稿 ---------------- */
function saveDraft() {
  if (G.stage === 'title') return;
  store.set('bh_draft', { v: 3, ...G });
}
function clearDraft() { store.set('bh_draft', null); }
function tryRestoreDraft() {
  try {
    const d = store.get('bh_draft');
    if (!d || d.v !== 3 || !d.stage || d.stage === 'title') return false;
    Object.assign(G, d); G.moving = null;
    if (!Array.isArray(G.slots) || !G.slots.length) initSlots();
    G.log = d.log || [];
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === screenId(G.stage)));
    const r = { card: renderSlots, idea: renderIdea, story: renderStory, style: renderStyle, board: renderBoard, prem: renderPrem }[G.stage];
    if (r) r();
    refreshStepbar(); syncDownstreamNotes();
    toast('📽️ 上次没拍完的片子已恢复,继续创作吧!');
    return true;
  } catch (e) { return false; }
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  /* 步骤条 */
  document.addEventListener('click', e => {
    const st = e.target.closest('.step[data-step]');
    if (st) { jumpTo(+st.getAttribute('data-step')); return; }
    const go = e.target.closest('[data-go]');
    if (go) {
      const st2 = go.getAttribute('data-go').replace('sc-', '');
      if (st2 === 'idea') renderIdea();
      if (st2 === 'story') renderStory();
      if (st2 === 'style') renderStyle();
      if (st2 === 'board') { if (!G.panels.length) initPanels(); renderBoard(); }
      if (st2 === 'card') renderSlots();
      show(st2);
      return;
    }
    /* 槽位操作 */
    const slotAct = e.target.closest('[data-act]');
    if (slotAct) {
      const card = slotAct.closest('.slotcard');
      if (card && card.dataset.i !== undefined) {
        const i = +card.dataset.i;
        const act = slotAct.getAttribute('data-act');
        if (act === 'draw') return drawSlot(i);
        if (act === 'write') return writeSlot(i);
        if (act === 'clearcard') return clearSlotCard(i);
        if (act === 'move') {                       /* 进入 / 退出"换格"模式 */
          G.moving = (G.moving === i) ? null : i;
          renderSlots();
          toast(G.moving === null ? '取消换格' : '🔀 现在点另一个格子的「↔ 换到这里」');
          return;
        }
        if (act === 'movehere') { if (typeof G.moving === 'number') return swapCards(G.moving, i); return; }
        if (act === 'left') return moveSlot(i, -1);
        if (act === 'right') return moveSlot(i, 1);
        if (act === 'delslot') {
          G.slots.splice(i, 1); G.moving = null;
          renderSlots(); saveDraft(); toast('格子已删除');
          return;
        }
      }
      const stCard = slotAct.closest('[data-style]');
      if (stCard && slotAct.getAttribute('data-act') === 'usepick') return chooseStyle(stCard.getAttribute('data-style'));
      /* 作品库操作 */
      const arch = slotAct.closest('.arch-item');
      if (arch) {
        const id = arch.dataset.id, act = slotAct.getAttribute('data-act');
        const list = store.get('bh_archive') || [];
        const it = list.find(x => x.id === id);
        if (act === 'replay') return openArchiveItem(id);
        if (act === 'export') return downloadText('《' + (it.title || '作品') + '》.bhfilm', JSON.stringify(it, null, 2));
        if (act === 'print') return printFilm(it);
        if (act === 'del') {
          if (!confirm('删掉《' + (it.title || '无题') + '》?删了就找不回来了')) return;
          store.set('bh_archive', list.filter(x => x.id !== id)); renderArchive(); toast('已删除');
          return;
        }
      }
    }
    /* 首映礼分镜操作 */
    const pa = e.target.closest('.act-paint, .act-accept');
    if (pa) {
      const panel = pa.closest('.panel');
      const p = G.panels[+panel.dataset.i];
      if (pa.classList.contains('act-paint')) {
        p.prm = panel.querySelector('.prm').value;
        p.cap = panel.querySelector('.cap').value;
        if (p.img) { p.img = null; p.aiDrawn = false; p.aiMsg = ''; toast('这一格换回免费程序画师;想要 AI 图就点「🖼️ AI 画这格」'); }
        paintPanel(p, +panel.dataset.i);
        G.panelsStale = true;
        lg('paint', '第 ' + (+panel.dataset.i + 1) + ' 格重画(v' + p.version + ')');
      } else {
        p.accepted = !p.accepted;
        if (p.accepted) { p.wrong = null; p.note = ''; paintPanel(p, +panel.dataset.i); toast('✅ 这格通过!(错版也能留,导演说了算)'); }
      }
      renderPanels(); saveDraft();
      return;
    }
  });
  document.addEventListener('input', e => {
    if (e.target.classList.contains('prm')) { G.panels[+e.target.closest('.panel').dataset.i].prm = e.target.value; }
    if (e.target.classList.contains('cap')) { G.panels[+e.target.closest('.panel').dataset.i].cap = e.target.value; }
  });

  /* 卡片拖拽:按住卡片拖到别的格子就换位置 */
  document.addEventListener('dragstart', e => {
    const sc = e.target.closest && e.target.closest('.slotcard');
    if (!sc) return;
    const i = +sc.dataset.i;
    if (!G.slots[i] || !G.slots[i].card) { e.preventDefault(); return; }
    G.dragFrom = i; G.moving = null;
    sc.classList.add('dragging');
    if (e.dataTransfer) { try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch (err) {} }
  });
  document.addEventListener('dragover', e => {
    const sc = e.target.closest && e.target.closest('.slotcard');
    if (!sc || G.dragFrom === null || G.dragFrom === undefined) return;
    if (+sc.dataset.i === G.dragFrom) return;
    e.preventDefault();
    sc.classList.add('dragover');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });
  document.addEventListener('dragleave', e => {
    const sc = e.target.closest && e.target.closest('.slotcard');
    if (sc) sc.classList.remove('dragover');
  });
  document.addEventListener('drop', e => {
    const sc = e.target.closest && e.target.closest('.slotcard');
    if (!sc) return;
    e.preventDefault();
    const to = +sc.dataset.i;
    $$('.slotcard').forEach(x => x.classList.remove('dragover', 'dragging'));
    if (G.dragFrom === null || G.dragFrom === undefined || G.dragFrom === to) { G.dragFrom = null; return; }
    const from = G.dragFrom; G.dragFrom = null;
    swapCards(from, to);
  });
  document.addEventListener('dragend', () => {
    $$('.slotcard').forEach(x => x.classList.remove('dragover', 'dragging'));
    G.dragFrom = null;
  });

  /* 触屏:长按卡片拖动(手机浏览器不触发 HTML5 拖拽) */
  (function touchDrag() {
    window.__touchDragReady = true;
    let from = null, ghost = null, timer = null, sx = 0, sy = 0, active = false;
    const clearAll = () => $$('.slotcard').forEach(x => x.classList.remove('dragover', 'dragging'));
    const dropAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return (el && el.closest) ? el.closest('.slotcard') : null;
    };
    document.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;                  /* 鼠标走原生拖拽 */
      const box = e.target.closest && e.target.closest('.slot-card[draggable="true"]');
      if (!box || (e.target.closest && e.target.closest('.slot-x'))) return;
      const sc = box.closest('.slotcard');
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => {
        timer = null; active = true; from = +sc.dataset.i;
        const c = G.slots[from].card || {};
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.textContent = (c.e || '') + ' ' + (c.t || '');
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        document.body.appendChild(ghost);
        sc.classList.add('dragging');
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) {} }
        toast('按住拖到别的格子,松手就换位置');
      }, 180);
    }, { passive: true });
    document.addEventListener('pointermove', e => {
      if (!active) {
        if (timer && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) { clearTimeout(timer); timer = null; }
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
      const sc = dropAt(e.clientX, e.clientY);
      $$('.slotcard').forEach(x => x.classList.toggle('dragover', x === sc && +x.dataset.i !== from));
    }, { passive: false });
    const finish = e => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!active) return;
      active = false;
      if (ghost) { ghost.remove(); ghost = null; }
      clearAll();
      const sc = dropAt(e.clientX, e.clientY);
      const f = from; from = null;
      if (sc && f !== null && +sc.dataset.i !== f) swapCards(f, +sc.dataset.i);
    };
    document.addEventListener('pointerup', finish, { passive: true });
    document.addEventListener('pointercancel', e => { if (timer) { clearTimeout(timer); timer = null; } active = false; if (ghost) { ghost.remove(); ghost = null; } clearAll(); from = null; }, { passive: true });
  })();

  /* 位置 1 */
  $('#btn-addslot').onclick = addSlot;
  $('#btn-drawall').onclick = drawAll;
  $('#btn-clearall').onclick = clearAll;
  $('#btn-card2idea').onclick = () => {
    if (!requiredCardsDone()) { toast('先把主角、场景、经过抽出来(或自己写)'); return; }
    G.ideaStale = false; renderIdea(); show('idea');
  };

  /* 位置 2 */
  $('#btn-idea2story').onclick = () => {
    G.idea = ($('#ta-idea').value || '').trim();
    G.storyStale = false;
    show('story');
    /* 有 AI 编剧就直接生成(ai.js 提供);没有就退回离线整理草稿 */
    if (typeof aiScriptFromIdea === 'function' && aiScriptFromIdea()) return;
    ideaToStoryDraft(); renderStory();
    toast('📜 剧本草稿好了,不满意直接改!');
  };

  /* 位置 3 */
  const regenBtn = $('#btn-regen');
  if (regenBtn) regenBtn.onclick = () => {          /* 兼容旧按钮(现在由 ai.js 接管) */
    G.idea = $('#ta-idea').value;
    ideaToStoryDraft(); renderStory(); toast('🔁 重新整理好了');
  };
  $('#btn-story-save').onclick = () => {
    G.story = $('#ta-story').value;
    G.panels = []; G.panelsStale = true;
    lg('story', '导演手改了剧本 → ' + G.story.split('\n').filter(Boolean).length + ' 页');
    renderStory(); toast('✅ 剧本存好了,分镜会按这个版本重画');
  };
  $('#btn-story2style').onclick = () => { G.story = $('#ta-story').value || G.story; renderStyle(); show('style'); };

  /* 位置 4 */
  $('#btn-style-custom').onclick = () => {
    const v = ($('#in-style-custom').value || '').trim();
    if (!v) { toast('先写一个你想要的画风'); return; }
    chooseStyle(v);
  };
  $('#btn-style2board').onclick = () => {
    if (!G.style) { toast('先选一个画风'); return; }
    initPanels(); renderBoard(); show('board');
  };

  /* 位置 5 */
  $('#btn-addpanel').onclick = addPanel;
  $('#btn-delpanel').onclick = delPanel;
  $('#btn-paintall').onclick = () => { G.panels.forEach((p, i) => paintPanel(p, i)); renderPanels(); lg('paint', '全部重画了一遍'); };
  $('#btn-board2prem').onclick = () => {
    if (!G.panels.length) initPanels();
    const blank = G.panels.filter(p => !p.img && !p.svg);
    blank.forEach(p => paintPanel(p, G.panels.indexOf(p)));
    if (blank.length) toast('有 ' + blank.length + ' 格还没画,先用程序画师垫上;回第 5 步可以换成 AI 图');
    G.filmIdx = 0; renderPrem(); show('prem');
    toast('🎬 成片好了!点上面「生成影片」看片子');
  };

  /* 位置 6 */
  $('#btn-makefilm').onclick = async () => {
    const b = $('#btn-makefilm'), msg = $('#film-msg');
    b.disabled = true; const old = b.textContent; b.textContent = '🎬 录制中…';
    try {
      const r = await makeFilm(t => { msg.textContent = '⏳ ' + t; });
      msg.textContent = '✅ 影片好了!上面就能播放(' + r.pages + ' 页 · ' + Math.round(r.ms / 1000) + ' 秒 · ' + Math.round(r.size / 1024) + ' KB)';
      renderPlayer();
      toast('🎥 影片生成成功!');
    } catch (e) { msg.textContent = '❌ ' + String(e.message || e); }
    b.disabled = false; b.textContent = old;
  };
  $('#btn-prev').onclick = () => goPage(G.filmIdx - 1);
  $('#btn-next').onclick = () => goPage(G.filmIdx + 1);
  $('#btn-auto').onclick = () => {
    let i = 0; goPage(0);
    const timer = setInterval(() => { i++; if (i > G.panels.length) { clearInterval(timer); return; } goPage(i); }, 2600);
  };
  $('#btn-voice').onclick = () => {
    if (!VOICE.ok) { toast('这个浏览器不支持朗读,建议用 Edge/Chrome'); return; }
    VOICE.on = !VOICE.on; syncVoiceBtn();
    if (VOICE.on) { speakPage(); toast('🔊 朗读已开,翻页自动念台词'); } else stopSpeak();
  };
  $('#btn-backstage').onclick = () => { const b = $('#backstage'); b.classList.toggle('hidden'); renderBackstage(); };
  $('#filmstrip').onclick = e => { const t = e.target.closest('.thumb'); if (t) goPage(+t.dataset.fi); };
  $('#btn-save').onclick = saveFilm;
  $('#btn-exportfilm').onclick = () => { const it = filmItem(); downloadText('《' + (it.title || '作品') + '》.bhfilm', JSON.stringify(it, null, 2)); toast('⬇️ 已导出作品文件'); };
  $('#btn-print').onclick = () => printFilm();

  /* 首页 */
  $('#btn-newfilm').onclick = () => {
    G.director = ($('#in-director').value || '小导演').trim().slice(0, 12);
    G.intern = ($('#in-intern').value || '小映').trim().slice(0, 8);
    Object.assign(G, { idea: '', story: '', storyDraft: '', style: '', stylePicked: false, panels: [], title: '', refl: ['', ''], statement: '', log: [], replayId: '', videoUrl: '', filmMs: 0, moving: null });
    initSlots(); renderSlots(); show('card');
    toast('🎬 开拍!先抽三张必抽的卡');
  };
  $('#btn-archive').onclick = () => { const w = $('#arch-list'); w.classList.toggle('hidden'); renderArchive(); };
  $('#btn-settings').onclick = () => { openSettings(); $('#m-settings').classList.remove('hidden'); };
  $('#btn-help').onclick = () => $('#m-help').classList.remove('hidden');
  $('#btn-help-close').onclick = () => $('#m-help').classList.add('hidden');
  $('#btn-settings-close').onclick = () => $('#m-settings').classList.add('hidden');
  $$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); }));

  /* 设置 */
  $('#wrong-on').onclick = () => { G.wrongOn = true; openSettings(); toast('☠️ 翻车时刻已开:提示词写糊了小映就会画错——这正是教学点'); };
  $('#wrong-off').onclick = () => { G.wrongOn = false; openSettings(); toast('😇 翻车时刻已关,小映这次不闹脾气'); };
  const clrMine = $('#btn-clear-mine');
  if (clrMine) clrMine.onclick = () => {
    if (!confirm('清掉你自己加进卡池的所有卡?(作品不会动)')) return;
    saveMyCards({});
    initSlots(); renderSlots();
    $('#data-msg').textContent = '你加的卡已清掉,卡池回到标准的 50 张。';
  };
  $('#btn-clear-draft').onclick = () => { clearDraft(); $('#data-msg').textContent = '草稿已清掉。'; };
  $('#btn-clear-all').onclick = () => {
    if (!confirm('清空本机所有数据(作品库、草稿、设置)?清了就找不回来了')) return;
    try { localStorage.clear(); } catch (e) {}
    $('#data-msg').textContent = '已清空,刷新页面就回到全新状态。';
  };
}
function openSettings() {
  const on = G.wrongOn;
  $('#wrong-on').style.background = on ? '#00b894' : '';
  $('#wrong-on').style.color = on ? '#fff' : '';
  $('#wrong-off').style.background = on ? '' : '#e17055';
  $('#wrong-off').style.color = on ? '' : '#fff';
}
function renderBackstage() {
  const b = $('#backstage');
  b.innerHTML = G.panels.map((p, i) => `<div style="margin-bottom:8px">
      <b>第 ${i + 1} 格</b> · 画面提示词:${esc(p.prm || '(空着,' + internName() + '只能自己发挥)')}
      ${p.wrong ? '<br><span style="color:#ff9f8a">⚠️ 这一格翻过车:' + esc(p.wrong) + '</span>' : ''}
    </div>`).join('') || '还没有分镜';
}

/* ---------------- 启动 ---------------- */
function boot() {
  const prof = store.get('bh_profile');
  if (prof && prof.director) $('#in-director').value = prof.director;
  initSlots();
  if (!tryRestoreDraft()) { show('title'); }
  renderArchive();
}
bindEvents();
boot();
