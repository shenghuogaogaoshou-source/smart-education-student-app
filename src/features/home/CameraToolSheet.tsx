import { X } from 'lucide-react'
import { cameraTools } from './homeData'

export function CameraToolSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="tool-sheet" role="dialog" aria-modal="true" aria-labelledby="camera-sheet-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-head"><div><p>统一识别入口</p><h2 id="camera-sheet-title">拍照与识别工具</h2></div><button type="button" aria-label="关闭工具面板" onClick={onClose}><X aria-hidden="true" /></button></div>
        <div className="tool-grid">
          {cameraTools.map(({ title, Icon }) => <button type="button" key={title} onClick={() => undefined}><Icon aria-hidden="true" size={21} /><span>{title}</span></button>)}
        </div>
        <p className="service-notice">页面初版暂未接入相机与识别服务</p>
      </section>
    </div>
  )
}
