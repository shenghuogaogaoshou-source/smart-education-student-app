import assert from 'node:assert/strict';
import test from 'node:test';

const plan = await import('../src/filmPlan.js');

const panelsOf = (...caps) => caps.map(cap => ({ cap, img: 'data:x-' + cap }));

test('每格提示词带本格剧本句、画风和承接上一格', () => {
  const p = plan.panelPrompt({ caption: '小鲸鱼游进海底理发店', prevCaption: '鲸鱼被海浪带到岸边', cards: ['圆滚滚的小鲸鱼', '海底理发店'], style: '水彩绘本' });

  assert.match(p, /小鲸鱼游进海底理发店/);
  assert.match(p, /上一格是「鲸鱼被海浪带到岸边」/);
  assert.match(p, /水彩绘本/);
  assert.match(p, /圆滚滚的小鲸鱼/);
  assert.match(p, /保持一致/);
});

test('第一格没有"上一格"就不硬凑承接句', () => {
  const p = plan.panelPrompt({ caption: '开场', prevCaption: '', style: '蜡笔' });

  assert.doesNotMatch(p, /上一格是/);
  assert.match(p, /开场/);
});

test('提示词长度不超过服务端的安全线', () => {
  const p = plan.panelPrompt({ caption: '很长的句子'.repeat(200), prevCaption: '更长的上一格'.repeat(100), style: '水彩' });
  assert.ok(p.length <= 500, '实际长度 ' + p.length);
});

test('格子有几格就拍几段,顺序和剧本一致', () => {
  const { segments, dropped } = plan.planSegments(panelsOf('第一句', '第二句', '第三句'));

  assert.equal(segments.length, 3);
  assert.equal(dropped, 0);
  assert.deepEqual(segments.map(s => s.line), ['第一句', '第二句', '第三句']);
  assert.deepEqual(segments.map(s => s.index), [0, 1, 2]);
  assert.match(segments[1].prompt, /上一格是「第一句」/);
});

test('超过 10 格只拍前 10 格,并说明丢了几格', () => {
  const { segments, dropped } = plan.planSegments(panelsOf(...Array.from({ length: 13 }, (_, i) => '句子' + i)));

  assert.equal(segments.length, 10);
  assert.equal(dropped, 3);
  assert.equal(segments[9].line, '句子9');
});

test('没有分镜就一段都不拍', () => {
  assert.deepEqual(plan.planSegments([]), { segments: [], dropped: 0 });
  assert.deepEqual(plan.planSegments(null).segments, []);
});

test('已生成好的段不重复买,只补缺的', () => {
  const { segments } = plan.planSegments(panelsOf('a', 'b', 'c'));
  const done = { 0: { videoUrl: '/api/films/seg0.mp4' }, 2: { videoUrl: '/api/films/seg2.mp4' } };

  assert.deepEqual(plan.pendingSegments(segments, done).map(s => s.index), [1]);
  assert.deepEqual(plan.pendingSegments(segments, {}).map(s => s.index), [0, 1, 2]);
  assert.deepEqual(plan.pendingSegments(segments, { 0: { videoUrl: '' } }).map(s => s.index), [0, 1, 2], '空地址不算做完');
});

test('开始前能算出调用次数、最短片长和大概等待时间', () => {
  const e = plan.estimateFilm({ count: 6 });

  assert.equal(e.calls, 6);
  assert.equal(e.filmSecondsLeast, 30);
  assert.equal(e.waitLow, 20, '6 段 / 3 并发 = 2 波');
  assert.equal(e.waitHigh, 120);
});

test('没有镜头时预估全为 0(不会算出负数或 NaN)', () => {
  const e = plan.estimateFilm({ count: 0 });
  assert.deepEqual(e, { calls: 0, filmSecondsLeast: 0, waitLow: 0, waitHigh: 0 });
});
