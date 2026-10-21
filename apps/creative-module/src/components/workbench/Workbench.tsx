// ============================================================
// Workbench —— 工作台主布局
// 顶部工具栏 / 左侧模块市场 / 中央画布 / 右侧检视器 / 底部状态栏
// ============================================================
import { useState } from 'react'
import { Toolbar } from './Toolbar'
import { Canvas } from './Canvas'
import { StatusBar } from './StatusBar'
import { WorkCheckPanel } from './WorkCheckPanel'

interface WorkbenchProps {
  onOpenLevels?: () => void
}

export function Workbench({ onOpenLevels }: WorkbenchProps) {
  const [worksOpen, setWorksOpen] = useState(false)
  return (
    <div className="relative flex h-full w-full flex-col bg-bg">
      <Toolbar onOpenLevels={onOpenLevels} onOpenWorks={() => setWorksOpen(true)} />
      {/* 画布保持挂载，市场与检视器由画布内独立面板承载。 */}
      <div className="min-h-0 w-full flex-1">
        <Canvas />
      </div>
      <StatusBar />
      {worksOpen && <WorkCheckPanel onClose={() => setWorksOpen(false)} />}
    </div>
  )
}
