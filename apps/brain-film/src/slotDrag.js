/* 抽卡页长按拖动:纯逻辑,不碰 DOM,node --test 可以直接测。
   两条规则:
   - 卡片拖动:目标格子空着就把卡搬过去,目标格子有卡就两张互换;
     必抽格允许被搬空,由「下一步」的必抽校验兜底。
   - 格子拖动:整格(连同里面的卡)插到目标位置,其余顺延。 */

export const LONG_PRESS_MS = 200        // 按住多久才算进入拖动
export const SLIDE_CANCEL_PX = 12       // 手指/鼠标在长按期间移动超过这么多,就当作滑动,取消长按

function validIndex(slots, i) {
  return Array.isArray(slots) && Number.isInteger(i) && i >= 0 && i < slots.length
}

/* 卡片换位。返回 null 表示这一下不算拖动(下标越界或源格没有卡)。 */
export function moveCard(slots, from, to) {
  if (!validIndex(slots, from) || !validIndex(slots, to) || from === to) return null
  const source = slots[from]
  const target = slots[to]
  if (!source.card) return null
  const dragged = source.card
  const displaced = target.card || null
  target.card = dragged
  source.card = displaced
  return {
    kind: displaced ? 'swap' : 'move',
    card: dragged.t,
    from: source.name,
    to: target.name,
    displaced: displaced ? displaced.t : null,
  }
}

/* 整格排序:把第 from 格挪到第 to 个位置(其余顺延)。返回 null 表示原地没动。 */
export function reorderSlot(slots, from, to) {
  if (!validIndex(slots, from) || !validIndex(slots, to) || from === to) return null
  const [moved] = slots.splice(from, 1)
  slots.splice(to, 0, moved)
  return { name: moved.name, from, to, position: to + 1 }
}
