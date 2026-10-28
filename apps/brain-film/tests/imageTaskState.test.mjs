import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginImageTask,
  finishImageTask,
  normalizeImageTask,
} from '../src/imageTaskState.js'

test('beginning a redraw keeps the existing image until the new task succeeds', () => {
  const panel = { img: 'old-image', aiMsg: '' }
  const next = beginImageTask(panel, 'task-img-1')
  assert.equal(next.img, 'old-image')
  assert.equal(next.imageTaskId, 'task-img-1')
  assert.equal(next.imageTaskStatus, 'queued')
})

test('task normalization keeps only valid resumable fields', () => {
  assert.deepEqual(normalizeImageTask({
    img: 'old',
    imageTaskId: 'task-img-1',
    imageTaskStatus: 'running',
    imageTaskError: 'ignored',
  }), {
    img: 'old',
    imageTaskId: 'task-img-1',
    imageTaskStatus: 'running',
  })
})

test('finishing a task replaces the image only on success', () => {
  const running = beginImageTask({ img: 'old-image' }, 'task-img-1')
  assert.equal(finishImageTask(running, 'failed', '', '画图失败').img, 'old-image')
  assert.equal(finishImageTask(running, 'succeeded', 'new-image').img, 'new-image')
  assert.equal(finishImageTask(running, 'succeeded', 'new-image').imageTaskId, '')
})
