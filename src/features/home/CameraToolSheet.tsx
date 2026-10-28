import { ArrowLeft, Camera, Check, Copy, Download, ImagePlus, LoaderCircle, Volume2, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cameraTools } from './homeData'
import { imageMaxEdgeForTool, readImage, scanImage, toolDetails, type ToolId, type ToolResult } from './recognitionTools'
import './recognitionTools.css'
import { RecognitionResultView, extensionTitle } from './RecognitionResultView'
import { readResult } from './readResult'
import { requestWithRetry } from '../../app/apiRequest'
import { isNativeApp } from '../../app/mobileApi'
import { createTask, pollTask, type TaskView } from '@zhiya/task-client'

export type VisionTaskHandle = {
  taskId: string
  tool: ToolId
  title: string
  createdAt: string
}

type CameraToolSheetProps = {
  open: boolean
  onClose: () => void
  onTaskStarted?: (task: VisionTaskHandle) => void
  initialTool?: number | null
  initialImage?: string
  createTaskImpl?: typeof createTask
  pollTaskImpl?: typeof pollTask
}

export function CameraToolSheet({
  open,
  onClose,
  onTaskStarted,
  initialTool = null,
  initialImage = '',
  createTaskImpl = createTask,
  pollTaskImpl = pollTask,
}: CameraToolSheetProps) {
  return open
    ? <ToolDialog
        onClose={onClose}
        onTaskStarted={onTaskStarted}
        initialTool={initialTool}
        initialImage={initialImage}
        createTaskImpl={createTaskImpl}
        pollTaskImpl={pollTaskImpl}
      />
    : null
}
function ToolDialog({
  onClose,
  onTaskStarted,
  initialTool,
  initialImage,
  createTaskImpl,
  pollTaskImpl,
}: {
  onClose: () => void
  onTaskStarted?: (task: VisionTaskHandle) => void
  initialTool: number | null
  initialImage: string
  createTaskImpl: typeof createTask
  pollTaskImpl: typeof pollTask
}) {
  const [selected, setSelected] = useState<number | null>(initialTool)
  const [image, setImage] = useState(initialImage)
  const [text, setText] = useState('')
  const [target, setTarget] = useState('中文')
  const [result, setResult] = useState<ToolResult | null>(null)
  const [reading, setReading] = useState(false)
  const stopReadingRef = useRef<(() => void) | null>(null)
  function stopReading() { stopReadingRef.current?.(); stopReadingRef.current = null; setReading(false) }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [camera, setCamera] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const dialog = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const tool = selected === null ? null : toolDetails[selected]
  const stopCamera = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false) }
  useEffect(() => {
    const oldFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => { stopReadingRef.current?.(); generation.current++; request.current?.abort(); request.current = null; stream.current?.getTracks().forEach(t => t.stop()); document.body.style.overflow = overflow; oldFocus?.focus() }
  }, [])
  useEffect(() => { if (camera && video.current) video.current.srcObject = stream.current }, [camera])
  const reset = () => {
    stopReading()
    setDragging(false); dragDepth.current = 0
    generation.current++; request.current?.abort(); request.current = null; stopCamera(); setBusy(false); setLoadingImage(false)
    setImage(''); setText(''); setResult(null); setError(''); setNotice('')
  }
  async function pick(file?: File) {
    if (!file) return
    const token = ++generation.current
    setLoadingImage(true); setError(''); setResult(null)
    try {
      const data = await readImage(file, tool
        ? { maxEdge: imageMaxEdgeForTool(tool.id), preserveOriginal: tool.id === 'scan' }
        : {})
      if (token === generation.current) setImage(data)
    }
    catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : '图片读取失败，请重新选择。') }
    finally { if (token === generation.current) setLoadingImage(false) }
  }
  async function startCamera() {
    const token = ++generation.current
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前环境无法打开相机，请使用上传图片。')
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1600 } }, audio: false })
      if (token !== generation.current) { media.getTracks().forEach(t => t.stop()); return }
      stream.current = media; setCamera(true)
    } catch (error) {
      if (token !== generation.current) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setError('相机权限还没有开启，请到系统设置允许智芽使用相机，或先上传图片。')
      } else if (error instanceof DOMException && error.name === 'NotFoundError') {
        setError('没有找到可用的相机，请改用上传图片。')
      } else if (error instanceof DOMException && error.name === 'NotReadableError') {
        setError('相机正被其他应用使用，请关闭其他相机后再试，或先上传图片。')
      } else {
        setError('无法打开相机。请检查相机权限，或使用上传图片。')
      }
    }
  }
  function openCamera() {
    if (isNativeApp()) {
      cameraInput.current?.click()
      return
    }
    void startCamera()
  }
  function capture() {
    const el = video.current
    if (!el?.videoWidth) { setError('相机还未准备好，请稍后拍摄。'); return }
    const canvas = document.createElement('canvas')
    const ratio = Math.min(1, 1600 / Math.max(el.videoWidth, el.videoHeight))
    canvas.width = Math.round(el.videoWidth * ratio); canvas.height = Math.round(el.videoHeight * ratio)
    canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height)
    setImage(canvas.toDataURL('image/jpeg', .9)); setResult(null); stopCamera()
  }
  async function run() {
    if (!tool) return
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(''); setNotice(''); setResult(null)
    const timeout = window.setTimeout(() => controller.abort(), 210000)
    try {
      let scanResult: ToolResult | null = null
      if (tool.id === 'scan') scanResult = await scanImage(image)
      if (controller.signal.aborted) return
      const payload = {
        tool: tool.id,
        image: scanResult ? '' : image,
        text: scanResult ? scanResult.output : text,
        target,
      }

      if (isNativeApp()) {
        const clientTaskId = globalThis.crypto?.randomUUID?.() ?? `camera-${Date.now()}`
        const created = await createTaskImpl({
          kind: 'vision',
          payload,
          clientTaskId,
        }, { signal: controller.signal })
        onTaskStarted?.({
          taskId: created.taskId,
          tool: tool.id,
          title: cameraTools[selected!].title,
          createdAt: created.createdAt,
        })
        const backgroundTimer = window.setTimeout(() => {
          if (request.current === controller) onClose()
        }, 12_000)
        let completed: TaskView
        try {
          completed = await pollTaskImpl(created.taskId, { signal: controller.signal })
        } finally {
          window.clearTimeout(backgroundTimer)
        }
        if (completed.status !== 'succeeded' || !completed.result || typeof completed.result !== 'object') {
          throw new Error(completed.error || '识别没有完成，请重新试一次。')
        }
        setResult(scanResult ? {
          ...(completed.result as ToolResult),
          scanContent: scanResult.output,
          evidence: [...scanResult.evidence, ...(completed.result as ToolResult).evidence],
          steps: [scanResult.steps[0], ...(completed.result as ToolResult).steps],
        } : {
          ...(completed.result as ToolResult),
          sourceText: tool.id === 'translate' && !image ? text : (completed.result as ToolResult).sourceText,
        })
      } else {
        const response = await requestWithRetry('/api/companion/recognize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(payload),
        }, {
          attempts: 2,
          timeoutMs: 210_000,
        })
        const data = await response.json()
        if (!response.ok) {
          const messages: Record<string, string> = { vision_not_configured: '图片识别服务尚未配置，请联系管理员。', text_not_configured: '文字分析服务尚未配置，请联系管理员。', invalid_input: '请检查输入内容或重新选择图片。', invalid_result: '这次没有整理好结果，请重试；如果是整页试卷，可以分题拍摄。', result_too_long: '这一页内容较多，请分段或分题拍摄，让文字更清楚。' }
          throw new Error(messages[data.error] || '识别服务暂时不可用，请稍后重试。')
        }
        if (!controller.signal.aborted) setResult(scanResult ? {
          ...data.result,
          scanContent: scanResult.output,
          evidence: [...scanResult.evidence, ...data.result.evidence],
          steps: [scanResult.steps[0], ...data.result.steps],
        } : { ...data.result, sourceText: tool.id === 'translate' && !image ? text : data.result.sourceText })
      }
    } catch (e) {
      if (request.current !== controller) return
      const timedOut = controller.signal.aborted || (e instanceof DOMException && e.name === 'TimeoutError')
      setError(timedOut ? '处理时间有点久，已经停下啦。请检查网络后再试一次。' : e instanceof Error ? e.message : '处理失败，请重试。')
    }
    finally { clearTimeout(timeout); if (request.current === controller) { setBusy(false); request.current = null } }
  }
  const resultText = result ? `${result.title}${result.scanContent ? `\n\n码中原始内容\n${result.scanContent}` : ''}${result.sourceText ? `\n\n原文\n${result.sourceText}` : ''}\n\n${result.output}\n\n识别依据\n${result.evidence.join('\n')}\n\n方法说明\n${result.steps.map(s => `${s.title}：${s.detail}`).join('\n')}\n\n需要注意\n${result.uncertainty}${result.introduction ? `\n\n${tool?.id === 'object' ? '认识这个物品' : '拓展科普'}\n${result.introduction.overview}\n\n你知道吗？\n${result.introduction.funFact}\n\n观察一下，想一想\n${result.introduction.question}` : ''}` : ''
  function toggleReading() {
    if (reading) { stopReading(); return }
    if (!result) return
    setNotice(''); setReading(true)
    const speechText = resultText
    try { stopReadingRef.current = readResult(speechText, () => { setReading(false) }, () => { setReading(false); setNotice('朗读未能完成，请确认设备已安装中文语音后重试。') }) }
    catch (e) { setReading(false); setNotice(e instanceof Error ? e.message : '朗读暂时不可用。') }
  }
  const requiresImage = tool && ['object', 'scan', 'ocr'].includes(tool.id)
  return <div className="sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section ref={dialog} tabIndex={-1} className="tool-sheet recognition-sheet" role="dialog" aria-modal="true" aria-labelledby="camera-sheet-title"
      onDragEnter={e => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault(); dragDepth.current++
        if (tool && !busy && !loadingImage && !camera && !result) setDragging(true)
      }}
      onDragOver={e => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = tool && !busy && !loadingImage && !camera && !result ? 'copy' : 'none'
      }}
      onDragLeave={e => {
        e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={e => {
        e.preventDefault(); dragDepth.current = 0; setDragging(false)
        if (!tool || busy || loadingImage || camera || result) return
        const files = Array.from(e.dataTransfer.files)
        if (files.length !== 1) { setError('请每次拖入一张图片。'); return }
        void pick(files[0])
      }}
      onKeyDown={e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,select,input:not(:disabled),[tabindex="0"]') || [])]
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }}>
      <header className="sheet-head">
        {tool && <button type="button" aria-label="返回工具列表" onClick={() => { reset(); setSelected(null) }}><ArrowLeft size={20} /></button>}
        <div><p>{tool ? '观察 · 理解 · 验证' : '发现身边的知识'}</p><h2 id="camera-sheet-title">{selected === null ? '拍照与识别工具' : cameraTools[selected].title}</h2></div>
        <button type="button" aria-label="关闭工具面板" onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      {!tool ? <><div className="tool-grid">{cameraTools.map(({ title, Icon }, i) => <button type="button" key={title} onClick={() => { reset(); setSelected(i) }}><Icon aria-hidden="true" size={21} /><span>{title}</span></button>)}</div><p className="service-notice">拍照、上传或输入文字，查看结果与判断依据</p></> : <div className="recognition-body">
        <p className="recognition-hint">{tool.hint}</p>
        {!result && <>
          <div className={`recognition-drop-hint${dragging ? ' is-dragging' : ''}`} role="status">{dragging ? '松开鼠标，上传这张图片' : '也可以将一张图片拖到此面板上传'}</div>
          <div className="recognition-input-actions">
            <button type="button" disabled={busy || camera || loadingImage} onClick={openCamera}><Camera size={18} />打开相机</button>
            <input
              ref={cameraInput}
              className="recognition-camera-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              aria-label="用相机拍摄"
              disabled={busy || loadingImage}
              onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }}
            />
            <label className={busy || loadingImage ? 'is-disabled' : ''}><ImagePlus size={18} />上传图片<input type="file" aria-label="上传图片" accept="image/jpeg,image/png,image/webp" disabled={busy || loadingImage || camera} onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} /></label>
          </div>
          {camera && <div className="recognition-camera"><video ref={video} autoPlay playsInline muted /><button type="button" onClick={capture}>拍下这张</button><button type="button" onClick={stopCamera}>关闭相机</button></div>}
          {loadingImage && <p role="status">正在准备图片…</p>}
          {image && <div className="recognition-image"><img src={image} alt="待识别图片" /><button type="button" disabled={busy} onClick={() => setImage('')}>移除图片</button></div>}
          {!requiresImage && <label className="recognition-field">{tool.id === 'solve' ? '题目内容' : '文字内容'}<textarea maxLength={4000} value={text} disabled={busy} placeholder="输入要处理的文字，也可以上传图片…" onChange={e => { setText(e.target.value) }} /><small>{text.length} / 4000</small></label>}
          {tool.id === 'translate' && <label className="recognition-field">翻译为<select value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option>中文</option><option>英语</option></select></label>}
          <p className="recognition-privacy">{tool.id === 'scan' ? '图片在本机解码，点击开始后，码中的文字会发送给 AI 解读。请勿扫描包含私人信息的码。' : '点击开始后，材料会发送给识别服务。请勿上传人脸、姓名、住址等私人信息。'} 支持 JPG / PNG / WebP，大图会自动等比压缩。</p>
          {busy ? <div className="recognition-progress" role="status"><LoaderCircle size={20} /><span>正在仔细观察，整理发现和解释…</span><button type="button" onClick={() => request.current?.abort()}>取消</button></div> : <div className="recognition-start"><button className="recognition-primary" type="button" disabled={loadingImage || camera || (requiresImage ? !image : !image && !text.trim())} onClick={run}>开始{tool.id === 'scan' ? '扫码' : '分析'}</button></div>}
        </>}
        {error && <p className="recognition-error" role="alert">{error}</p>}
        {result && <>
          <div className="recognition-result-meta"><Check size={16} />{tool.id === 'scan' ? '扫码结果与 AI 解读' : 'AI 的发现 · 一起核对看看'}</div>
          <div className="recognition-read"><button type="button" onClick={toggleReading} aria-pressed={reading}>{reading ? <Square size={17} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}{reading ? '停止朗读' : '朗读结果'}</button><span role="status">{reading ? '正在为你朗读…' : '听一听结果、方法和相关知识'}</span></div>
          <details className="recognition-source"><summary>查看本次材料</summary>{image && <img src={image} alt="本次分析的原图" />}{text && <p>{text}</p>}</details>
          <RecognitionResultView tool={tool.id} result={result} image={image} target={target} onNotice={setNotice} />
          {result.introduction && <section className="recognition-introduction">
            <p className="recognition-intro-kicker">多了解一点</p>
            <h3>{extensionTitle(tool.id)}</h3>
            <p>{result.introduction.overview}</p>
            <h4>你知道吗？</h4><p>{result.introduction.funFact}</p>
            <div className="recognition-think"><strong>观察一下，想一想</strong><p>{result.introduction.question}</p></div>
          </section>}
          <div className="recognition-result-actions"><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(resultText); setNotice('已复制结果和方法说明') } catch { setNotice('复制失败，请下载结果。') } }}><Copy size={16} />复制结果</button><button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([resultText], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${cameraTools[selected!].title}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}><Download size={16} />下载结果</button><button type="button" onClick={() => { stopReading(); setResult(null); setNotice(''); }}>再试一次</button></div>
        </>}
        {notice && <p role="status">{notice}</p>}
      </div>}
    </section>
  </div>
}
