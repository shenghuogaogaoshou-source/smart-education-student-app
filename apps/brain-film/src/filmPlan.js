/* 首映礼 · 逐格拍片:纯逻辑,不碰 DOM 也不发请求,node --test 可以直接测。
   思路:分镜有多少格就拍多少段镜头,每格用自己的那张图当首帧、自己那句剧本当提示词,
   再靠"承接上一格"的描述让镜头之间连得上。 */

export const MAX_SEGMENTS = 10          // 和服务端一次拼接的上限保持一致
export const MAX_CLIP_SECONDS = 5       // 单次图生视频产出的镜头长度(秒)
export const CONCURRENCY = 3            // 同时提交几个视频任务(太多会被限流)
export const MIN_SEGMENT_SECONDS = 5    // 一段成片至少这么长(旁白更长时以旁白为准)

const PROMPT_LIMIT = 500                // 服务端会截断到 600,这里留出余量

/* 一格的提示词:统一角色/画风在前,本格剧本句在后,再点明要承接上一格 */
export function panelPrompt({ caption = '', prevCaption = '', cards = [], style = '' } = {}) {
  const said = String(caption || '').trim();
  const prev = String(prevCaption || '').trim();
  const names = (Array.isArray(cards) ? cards : []).map(x => String(x || '').trim()).filter(Boolean);
  const skin = String(style || '').trim();
  const parts = ['儿童动画'];
  if (skin) parts.push('画风统一为' + skin);
  if (names.length) parts.push('片中的主角与角色有:' + names.join('、'));
  parts.push(said ? '这一格演的是:' + said : '这一格继续往下演');
  if (prev) parts.push('上一格是「' + prev + '」,画面和动作都要接着它往下走');
  parts.push('人物长相、衣服颜色、画风全程保持一致,镜头平稳,颜色明亮,适合小学生观看');
  return parts.join('。').slice(0, PROMPT_LIMIT);
}

/* 分镜格 → 镜头段。超上限的部分不拍,并告诉调用方丢了几格 */
export function planSegments(panels = [], { limit = MAX_SEGMENTS } = {}) {
  const list = Array.isArray(panels) ? panels : [];
  const keep = list.slice(0, Math.max(0, limit));
  const segments = keep.map((p, i) => ({
    index: i,
    line: String((p && p.cap) || '').trim(),
    prompt: panelPrompt({
      caption: p && p.cap,
      prevCaption: i > 0 ? (keep[i - 1] && keep[i - 1].cap) : '',
      cards: (p && p.cards) || [],
      style: (p && p.style) || '',
    }),
  }));
  return { segments, dropped: Math.max(0, list.length - segments.length) };
}

/* 已经有结果的段(中断后重进页面)不重复生成,只补缺的 */
export function pendingSegments(segments = [], done = {}) {
  const have = done && typeof done === 'object' ? done : {};
  return (Array.isArray(segments) ? segments : [])
    .filter(seg => !(have[seg.index] && have[seg.index].videoUrl));
}

/* 开始前的预估:调用几次、片子至少多长、大概等多久 */
export function estimateFilm({ count = 0, perTaskLow = 10, perTaskHigh = 60, concurrency = CONCURRENCY } = {}) {
  const calls = Math.max(0, count | 0);
  const waves = Math.ceil(calls / Math.max(1, concurrency));
  return {
    calls,
    filmSecondsLeast: calls * MIN_SEGMENT_SECONDS,
    waitLow: waves * perTaskLow,
    waitHigh: waves * perTaskHigh,
  };
}
