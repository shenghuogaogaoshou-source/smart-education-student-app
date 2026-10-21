import assert from 'node:assert/strict';
import test from 'node:test';

const drag = await import('../src/slotDrag.js');

function slotsOf(...cards) {
  return cards.map((t, i) => ({
    key: 'k' + i,
    name: '格' + i,
    required: i < 3,
    card: t ? { t, e: '🎬' } : null,
  }));
}

test('拖到有卡的格子:两张卡互换,格子和顺序都不变', () => {
  const slots = slotsOf('主角卡', '场景卡', null);
  const result = drag.moveCard(slots, 0, 1);

  assert.equal(result.kind, 'swap');
  assert.equal(result.card, '主角卡');
  assert.equal(result.displaced, '场景卡');
  assert.equal(slots[0].card.t, '场景卡');
  assert.equal(slots[1].card.t, '主角卡');
  assert.deepEqual(slots.map(s => s.name), ['格0', '格1', '格2']);
});

test('拖到空格子:卡直接搬过去,源格变空', () => {
  const slots = slotsOf('主角卡', null, null);
  const result = drag.moveCard(slots, 0, 2);

  assert.equal(result.kind, 'move');
  assert.equal(result.to, '格2');
  assert.equal(slots[0].card, null);
  assert.equal(slots[2].card.t, '主角卡');
  assert.equal(slots.length, 3, '搬卡不增删格子');
});

test('拖回自己身上 / 空格子起拖 / 越界都不算操作', () => {
  const slots = slotsOf('主角卡', null);
  assert.equal(drag.moveCard(slots, 0, 0), null);
  assert.equal(drag.moveCard(slots, 1, 0), null, '空格子拖不动');
  assert.equal(drag.moveCard(slots, 0, 9), null);
  assert.equal(drag.moveCard(slots, -1, 1), null);
  assert.equal(drag.moveCard(null, 0, 1), null);
});

test('整格拖动:插到目标位置,卡跟着格子走', () => {
  const slots = slotsOf('主角卡', '场景卡', '配角卡', '经过卡');
  const result = drag.reorderSlot(slots, 0, 3);

  assert.equal(result.name, '格0');
  assert.equal(result.position, 4);
  assert.deepEqual(slots.map(s => s.name), ['格1', '格2', '格3', '格0']);
  assert.equal(slots[3].card.t, '主角卡', '卡跟着格子过去');
  assert.equal(slots.length, 4, '排序不增删格子');
});

test('整格往前拖也能排,原地拖返回 null', () => {
  const slots = slotsOf(null, null, null, null);
  assert.deepEqual(drag.reorderSlot(slots, 3, 1) && slots.map(s => s.name), ['格0', '格3', '格1', '格2']);
  assert.equal(drag.reorderSlot(slots, 2, 2), null);
  assert.equal(drag.reorderSlot(slots, 0, 8), null);
});

test('长按阈值是 200ms,滑动超过 12px 取消', () => {
  assert.equal(drag.LONG_PRESS_MS, 200);
  assert.equal(drag.SLIDE_CANCEL_PX, 12);
});
