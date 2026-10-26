import { useEffect, useRef, useState, type RefObject } from 'react'
import { mountStudio } from './studioEngine'

export type Stage = 'title' | 'card' | 'idea' | 'story' | 'style' | 'board' | 'prem'
const stages: Stage[] = ['title', 'card', 'idea', 'story', 'style', 'board', 'prem']
export const stageTitles: Record<Stage, string> = { title: '我的放映厅', card: '抽脑洞卡', idea: '讲想法', story: '写剧本', style: '定画风', board: '画分镜', prem: '首映礼' }
/* navigate 返回 false = 这一步还没内容,引擎没真的跳(调用方要把返回栈还回去) */
interface StudioBridge { navigate: (stage: Stage) => boolean; resume: () => void; dispose: () => void }
const DRAFT_EVENT = 'bh-draft-changed'

function readHasDraft(): boolean {
  try {
    const draft = JSON.parse(localStorage.getItem('bh_draft') || 'null')
    return draft?.v === 3 && stages.includes(draft.stage) && draft.stage !== 'title'
  } catch { return false }
}

export function useStudioController(root: RefObject<HTMLDivElement | null>) {
  const bridge = useRef<StudioBridge | null>(null)
  const history = useRef<Stage[]>([])
  const active = useRef<Stage>('title')
  const returning = useRef(false)
  const positions = useRef(new Map<Stage, number>())
  const [stage, setStage] = useState<Stage>('title')
  const [canBack, setCanBack] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    if (!root.current) return
    const viewport = root.current.querySelector('.app-viewport') as HTMLElement
    const remember = () => positions.current.set(active.current, viewport.scrollTop)
    viewport.addEventListener('scroll', remember, { passive: true })
    /* 草稿在设置里被清掉、或引擎刚存了新草稿时,首页的「继续上次创作」要跟着变 */
    const refreshDraft = () => setHasDraft(readHasDraft())
    refreshDraft()
    window.addEventListener(DRAFT_EVENT, refreshDraft)
    bridge.current = mountStudio(root.current, (value: string, reason?: string) => {
      if (!stages.includes(value as Stage)) return
      const next = value as Stage
      if (reason === 'new-film') {          /* 开拍新片:返回栈和滚动记忆都属于上一部片子,清掉 */
        history.current = []
        positions.current.clear()
      }
      if (next !== active.current && !returning.current) history.current.push(active.current)
      active.current = next
      setStage(next)
      setCanBack(history.current.length > 0)
      refreshDraft()
      if (returning.current) {
        viewport.scrollTop = positions.current.get(next) ?? 0
        returning.current = false
      }
    }) as StudioBridge
    return () => {
      viewport.removeEventListener('scroll', remember)
      window.removeEventListener(DRAFT_EVENT, refreshDraft)
      bridge.current?.dispose()
      bridge.current = null
    }
  }, [root])
  return {
    stage, canBack, hasDraft,
    back: () => {
      const previous = history.current.pop()
      if (!previous) return
      returning.current = true
      const moved = bridge.current?.navigate(previous) !== false
      if (!moved) {                          /* 那一步没内容:把栈还回去,别让「返回」变成死按钮 */
        history.current.push(previous)
        returning.current = false
        setCanBack(history.current.length > 0)
      }
    },
    resume: () => {
      bridge.current?.resume()
      setHasDraft(readHasDraft())
    },
  }
}
