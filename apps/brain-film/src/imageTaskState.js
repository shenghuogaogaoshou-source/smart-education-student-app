const ACTIVE_STATUSES = new Set(['queued', 'running'])

export function normalizeImageTask(panel = {}) {
  const next = { ...panel }
  delete next.imageTaskError
  if (typeof panel.imageTaskId !== 'string' || !panel.imageTaskId.trim()) {
    delete next.imageTaskId
    delete next.imageTaskStatus
    return next
  }
  next.imageTaskStatus = ACTIVE_STATUSES.has(panel.imageTaskStatus) ? panel.imageTaskStatus : 'running'
  return next
}

export function beginImageTask(panel = {}, taskId) {
  return {
    ...normalizeImageTask(panel),
    imageTaskId: String(taskId),
    imageTaskStatus: 'queued',
  }
}

export function finishImageTask(panel = {}, status, image = '', message = '') {
  const next = { ...normalizeImageTask(panel) }
  if (status === 'succeeded' && image) {
    next.img = image
    next.aiDrawn = true
  }
  if (message) next.aiMsg = message
  next.imageTaskId = ''
  next.imageTaskStatus = status
  return next
}
