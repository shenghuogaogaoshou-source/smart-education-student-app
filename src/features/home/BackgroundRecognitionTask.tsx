import { Check, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pollTask, type TaskView } from '@zhiya/task-client'
import { readNativeTaskApiOrigin } from '../../app/mobileApi'
import { RecognitionResultView } from './RecognitionResultView'
import type { ToolResult } from './recognitionTools'
import type { VisionTaskHandle } from './CameraToolSheet'

export function BackgroundRecognitionTask({
  task,
  onDismiss,
  onRetry,
  pollTaskImpl = pollTask,
}: {
  task: VisionTaskHandle
  onDismiss: () => void
  onRetry?: () => void
  pollTaskImpl?: typeof pollTask
}) {
  const [state, setState] = useState<TaskView | null>(null)
  const [resultOpen, setResultOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const baseUrl = readNativeTaskApiOrigin()
    void pollTaskImpl(task.taskId, {
      signal: controller.signal,
      ...(baseUrl ? { baseUrl } : {}),
    })
      .then(setState)
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          setState({
            taskId: task.taskId,
            kind: 'vision',
            status: 'failed',
            error: 'task_unavailable',
            createdAt: task.createdAt,
            updatedAt: new Date().toISOString(),
            elapsedMs: 0,
          })
        }
      })
    return () => controller.abort()
  }, [pollTaskImpl, task.createdAt, task.taskId])

  const completed = state?.status === 'succeeded'
  const failed = state?.status === 'failed' || state?.status === 'interrupted'
  const result = completed ? state.result as ToolResult : null

  return (
    <>
      <aside className={`background-recognition-task${failed ? ' is-failed' : completed ? ' is-complete' : ''}`} aria-live="polite">
        <span className="background-recognition-task__icon">
          {completed ? <Check size={17} /> : failed ? <RotateCcw size={17} /> : <LoaderCircle className="background-task-spin" size={17} />}
        </span>
        <div>
          <strong>{failed ? '识别没有完成' : completed ? '识别完成' : '正在后台识别'}</strong>
          <small>{task.title}</small>
        </div>
        {completed ? (
          <button type="button" aria-label={`查看${task.title}结果`} onClick={() => setResultOpen(true)}>
            查看
          </button>
        ) : failed && onRetry ? (
          <button type="button" onClick={onRetry}>重试</button>
        ) : null}
        <button type="button" aria-label="关闭后台识别任务" onClick={onDismiss}><X size={16} /></button>
      </aside>

      {resultOpen && result && (
        <div className="sheet-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setResultOpen(false)
        }}>
          <section className="tool-sheet recognition-sheet" role="dialog" aria-modal="true" aria-label={`${task.title}结果`}>
            <header className="sheet-head">
              <div><p>后台识别已完成</p><h2>{task.title}</h2></div>
              <button type="button" aria-label="关闭识别结果" onClick={() => setResultOpen(false)}><X /></button>
            </header>
            <div className="recognition-body">
              <div className="recognition-result-meta"><Check size={16} />AI 的发现 · 一起核对看看</div>
              <RecognitionResultView tool={task.tool} result={result} image="" target="中文" onNotice={() => undefined} />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
