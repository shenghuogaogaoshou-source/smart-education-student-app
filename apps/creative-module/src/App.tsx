// ============================================================
// App —— 应用入口
// 简单路由：自由实验台 / 关卡选择 / 关卡运行
// 始终在后台初始化 COCO-SSD 目标检测引擎
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Workbench } from './components/workbench/Workbench'
import { LevelSelect } from './levels/LevelSelect'
import { LevelRunner } from './levels/LevelRunner'
import { useCircuit } from './store/circuitStore'
import { initDetector } from './lib/ai/objectDetector'
import { captureDraft, readDraft, saveDraft, type CircuitDraft } from './lib/circuitDraft'

type View = { name: 'lab' } | { name: 'levels' } | { name: 'level'; levelId: number }

export default function App() {
  const setModelStatus = useCircuit((s) => s.setModelStatus)
  const setEngine = useCircuit((s) => s.setEngine)
  const setPaletteFilter = useCircuit((s) => s.setPaletteFilter)
  const resetCircuit = useCircuit((s) => s.resetCircuit)
  const [view, setView] = useState<View>({ name: 'lab' })
  const loadedRef = useRef(false)
  const labDraft = useRef<CircuitDraft | null>(null)

  // 后台初始化 COCO-SSD（无论在哪个视图都需要）
  useEffect(() => {
    let cancelled = false
    setModelStatus('loading', '加载 COCO-SSD 模型…')
    initDetector()
      .then(() => {
        if (cancelled) return
        setEngine('coco-ssd')
        setModelStatus('ready', 'COCO-SSD 目标检测就绪')
      })
      .catch((err: Error) => {
        if (cancelled) return
        setEngine('none')
        setModelStatus('error', err.message || 'COCO-SSD 加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [setModelStatus, setEngine])

  // 视图切换到自由实验时：清除关卡过滤 + 重置电路（首次进入除外）
  const goLab = () => {
    setPaletteFilter(null)
    useCircuit.setState({ nodes: labDraft.current?.nodes ?? [], edges: labDraft.current?.edges ?? [], running: false, selectedNodeId: null })
    loadedRef.current = true // 标记已进入过，避免自动加载 demo
    setView({ name: 'lab' })
  }

  const goLevels = () => {
    if (view.name === 'lab') {
      const { nodes, edges } = useCircuit.getState()
      labDraft.current = captureDraft(nodes, edges)
      saveDraft(labDraft.current)
    }
    setPaletteFilter(null)
    resetCircuit()
    setView({ name: 'levels' })
  }

  const goLevel = (levelId: number) => {
    setView({ name: 'level', levelId })
  }

  // 首屏自动加载示例链路（仅 lab 视图，仅一次）
  const loadDemo = useCircuit((s) => s.loadDemoChain)
  const nodes = useCircuit((s) => s.nodes)
  useEffect(() => {
    if (view.name !== 'lab') return
    if (loadedRef.current) return
    loadedRef.current = true
    const saved = readDraft()
    if (saved) {
      labDraft.current = saved
      useCircuit.setState({ nodes: saved.nodes, edges: saved.edges, running: false, selectedNodeId: null })
    } else if (nodes.length === 0) loadDemo()
  }, [view.name, nodes.length, loadDemo])

  useEffect(() => {
    if (view.name !== 'lab') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const persist = () => {
      const { nodes, edges } = useCircuit.getState()
      labDraft.current = captureDraft(nodes, edges)
      // 存不下时（本地存储已满 / 隐私模式）明确告警，别让学生以为已经保存
      if (!saveDraft(labDraft.current)) {
        console.warn('画布草稿保存失败：本地存储已满或不可用，刷新后可能丢失修改')
      }
    }
    const unsubscribe = useCircuit.subscribe((state, previous) => {
      if (state.running || (state.nodes === previous.nodes && state.edges === previous.edges)) return
      clearTimeout(timer)
      timer = setTimeout(persist, 350)
    })
    window.addEventListener('pagehide', persist)
    return () => { clearTimeout(timer); unsubscribe(); window.removeEventListener('pagehide', persist) }
  }, [view.name])

  if (view.name === 'levels') {
    return <LevelSelect onBack={goLab} onEnter={goLevel} />
  }

  if (view.name === 'level') {
    return <LevelRunner levelId={view.levelId} onBack={goLevels} />
  }

  return <Workbench onOpenLevels={goLevels} />
}
