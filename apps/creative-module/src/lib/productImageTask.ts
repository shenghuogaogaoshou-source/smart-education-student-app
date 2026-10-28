import { createTask, getTask, pollTask, type TaskView } from '@zhiya/task-client'

const STORAGE_KEY = 'creative-product-image-task'

export type StoredProductImageTask = {
  taskId: string
  prompt: string
  createdAt: string
}

function readJson(): StoredProductImageTask | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<StoredProductImageTask> | null
    return value?.taskId && value.prompt && value.createdAt ? value as StoredProductImageTask : null
  } catch {
    return null
  }
}

export function readProductImageTask(): StoredProductImageTask | null {
  return readJson()
}

export function rememberProductImageTask(task: TaskView, prompt: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    taskId: task.taskId,
    prompt,
    createdAt: task.createdAt,
  } satisfies StoredProductImageTask))
}

export function clearProductImageTask() {
  localStorage.removeItem(STORAGE_KEY)
}

export async function startProductImageTask(prompt: string, clientTaskId: string): Promise<TaskView> {
  const task = await createTask({
    kind: 'product-image',
    clientTaskId,
    payload: {
      prompt,
      size: '2048x2048',
      response_format: 'b64_json',
      watermark: false,
    },
  })
  rememberProductImageTask(task, prompt)
  return task
}

export async function restoreProductImageTask() {
  const stored = readJson()
  if (!stored) return null
  const task = await getTask(stored.taskId)
  if (task.status === 'queued' || task.status === 'running') {
    return pollTask(stored.taskId)
  }
  return task
}
