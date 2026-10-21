// ============================================================
// WorkCheckPanel —— 作品检查与导出（右下角浮层）
//   1) 本机结构自检（立刻、确定）
//   2) AI 审查（DeepSeek）
//   3) 生成现实中相似物品的图片（火山方舟 seedream）
//   4) 导出作品 JSON / 导出实物图
// ============================================================
import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  Sparkles,
  ImagePlus,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  ClipboardCheck,
  X,
} from 'lucide-react'
import { useCircuit } from '../../store/circuitStore'
import {
  aiCheckCircuit,
  buildExport,
  buildProductPrompt,
  downloadImage,
  downloadText,
  generateProductImage,
  localCheck,
  summarizeCircuit,
  type ArtworkIssue,
} from '../../lib/artwork'
import { creativeDraftId, saveArtworkToZhiya } from '../../integration/saveToZhiya'

const SEV_STYLE = {
  error: { color: 'var(--red)', bg: 'rgba(198,107,90,0.12)', icon: XCircle, label: '必须修' },
  warning: { color: 'var(--amber-dim)', bg: 'rgba(212,160,74,0.14)', icon: AlertTriangle, label: '建议修' },
  tip: { color: 'var(--cyan)', bg: 'rgba(107,163,195,0.12)', icon: Lightbulb, label: '提示' },
} as const

export function WorkCheckPanel({ onClose }: { onClose: () => void }) {
  const nodes = useCircuit((s) => s.nodes)
  const edges = useCircuit((s) => s.edges)

  const [aiIssues, setAiIssues] = useState<ArtworkIssue[] | null>(null)
  const [aiScore, setAiScore] = useState<number | null>(null)
  const [aiSummary, setAiSummary] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')

  const [imageSrc, setImageSrc] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [imaging, setImaging] = useState(false)
  const [imageError, setImageError] = useState('')

  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState('')
  const [savingZhiya, setSavingZhiya] = useState(false)

  const localIssues = useMemo(() => localCheck(nodes, edges), [nodes, edges])
  const summary = useMemo(() => summarizeCircuit(nodes, edges), [nodes, edges])
  const allIssues = [...localIssues, ...(aiIssues ?? [])]
  const errorCount = allIssues.filter((i) => i.severity === 'error').length
  const warnCount = allIssues.filter((i) => i.severity === 'warning').length

  const runCheck = async () => {
    setChecking(true)
    setCheckError('')
    setAiIssues(null)
    setAiScore(null)
    setAiSummary('')
    try {
      const res = await aiCheckCircuit(nodes, edges)
      setAiIssues(res.issues)
      setAiScore(res.score)
      setAiSummary(res.summary)
    } catch (err) {
      setCheckError((err as Error).message || 'AI 审查失败，请重试')
    } finally {
      setChecking(false)
    }
  }

  const runImage = async () => {
    setImaging(true)
    setImageError('')
    setImageSrc('')
    try {
      const prompt = buildProductPrompt(nodes, title)
      setImagePrompt(prompt)
      const src = await generateProductImage(prompt)
      setImageSrc(src)
    } catch (err) {
      setImageError((err as Error).message || '生成图片失败，请重试')
    } finally {
      setImaging(false)
    }
  }

  const doExportJson = () => {
    const data = buildExport(nodes, edges, title)
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadText(`ai-circuit-${stamp}.json`, JSON.stringify(data, null, 2))
    setSaved('已导出作品 JSON（元件、参数、连线、可读说明）')
  }

  const doExportImage = async () => {
    if (!imageSrc) return
    try {
      await downloadImage(`ai-circuit-art-${Date.now()}.jpg`, imageSrc)
      setSaved('已导出实物图')
    } catch {
      setSaved('实物图下载失败，可右键图片另存为')
    }
  }

  const doSaveToZhiya = async () => {
    setSavingZhiya(true)
    setSaved('')
    try {
      const draftId = creativeDraftId(nodes, edges)
      await saveArtworkToZhiya({
        draftId,
        title,
        description: summary.text,
        artwork: buildExport(nodes, edges, title),
      })
      setSaved('已保存到智芽·我的作品草稿')
    } catch {
      setSaved('智芽暂未同步，可先导出 JSON 保存到本地')
    } finally {
      setSavingZhiya(false)
    }
  }

  return (
    <div
      className="absolute bottom-3 right-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[380px] flex-col overflow-hidden rounded-xl bg-surface"
      style={{ border: '2.5px solid var(--ink)', boxShadow: '5px 5px 0 0 var(--ink)' }}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '2px solid var(--ink)', background: 'var(--amber)' + '1a' }}>
        <ClipboardCheck size={16} className="text-amber-dim" />
        <span className="handwritten text-[18px] font-bold text-ink">作品检查与导出</span>
        <span className="chip text-text-faint">
          {summary.moduleCount} 元件 · {summary.edgeCount} 连线
        </span>
        <button onClick={onClose} className="ml-auto rounded-lg p-1 transition hover:bg-ink/10" aria-label="关闭作品检查">
          <X size={16} className="text-text-dim" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {/* 作品名 */}
        <div>
          <label className="chip text-text-faint">作品名（用于导出和生成图片）</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：我的海洋清洁机器人"
            className="mt-1 w-full rounded-md px-2 py-1.5 font-kalam text-[13px] text-text focus:outline-none"
            style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
          />
        </div>

        {/* 检查结果概览 */}
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-mono text-[11.5px]"
          style={{
            border: `2px solid ${errorCount ? 'var(--red)' : warnCount ? 'var(--amber)' : 'var(--green)'}`,
            background: errorCount ? 'rgba(198,107,90,0.1)' : warnCount ? 'rgba(212,160,74,0.12)' : 'rgba(138,171,110,0.12)',
          }}
        >
          {errorCount ? <XCircle size={14} className="text-red-sig" /> : warnCount ? <AlertTriangle size={14} className="text-amber-dim" /> : <CheckCircle2 size={14} className="text-green-sig" />}
          <span className="font-bold text-ink">
            {errorCount ? `${errorCount} 个必须修的问题` : warnCount ? `${warnCount} 个建议修的问题` : '结构检查通过'}
          </span>
          {aiScore !== null && (
            <span className="ml-auto rounded px-1.5 py-0.5 font-bold" style={{ background: 'var(--surface)', border: '1.5px solid var(--ink)' }}>
              AI 评分 {aiScore}
            </span>
          )}
        </div>

        {/* AI 审查按钮 */}
        <div className="flex gap-2">
          <button
            onClick={runCheck}
            disabled={checking || !nodes.length}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[12px] font-bold text-ink disabled:opacity-40"
            style={{ border: '2px solid var(--ink)', background: 'var(--violet)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            {checking ? <Loader2 size={13} className="spin-slow" /> : <ShieldCheck size={13} />}
            {checking ? 'AI 检查中…' : '让 AI 帮我检查'}
          </button>
          <button
            onClick={() => { setAiIssues(null); setAiScore(null); setAiSummary('') }}
            className="rounded-lg px-2.5 py-2 font-mono text-[11.5px] text-text-dim"
            style={{ border: '2px solid var(--ink)', background: 'var(--surface)' }}
            title="只保留本机结构检查结果"
          >
            清空
          </button>
        </div>

        {checkError && (
          <p className="rounded-md px-2 py-1.5 text-[12px] text-red-sig" style={{ border: '1.5px solid var(--red)', background: 'rgba(198,107,90,0.1)' }}>
            {checkError}
          </p>
        )}
        {aiSummary && (
          <p className="rounded-md px-2 py-1.5 text-[12px] leading-relaxed text-text" style={{ border: '1.5px solid var(--green)', background: 'rgba(138,171,110,0.1)' }}>
            <b className="text-green-sig">AI 总评：</b>{aiSummary}
          </p>
        )}

        {/* 问题列表 */}
        <div className="space-y-1.5">
          {allIssues.length === 0 && (
            <p className="rounded-md px-2 py-2 text-center text-[12px] text-green-sig" style={{ border: '1.5px dashed var(--green)' }}>
              没发现明显问题，可以运行起来看看效果
            </p>
          )}
          {allIssues.map((issue, i) => {
            const st = SEV_STYLE[issue.severity]
            const Icon = st.icon
            return (
              <div key={`${issue.from}-${i}`} className="rounded-lg px-2 py-1.5" style={{ border: `1.5px solid ${st.color}`, background: st.bg }}>
                <div className="flex items-center gap-1.5">
                  <Icon size={12} style={{ color: st.color }} />
                  <span className="text-[12.5px] font-bold" style={{ color: st.color }}>{issue.title}</span>
                  <span className="chip ml-auto text-[9.5px] text-text-faint">
                    {issue.from === 'ai' ? 'AI' : '结构'} · {st.label}
                  </span>
                </div>
                {issue.detail && <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-dim">{issue.detail}</p>}
                {issue.fix && <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-faint">怎么改：{issue.fix}</p>}
              </div>
            )
          })}
        </div>

        {/* 生成实物图 */}
        <div className="rounded-lg p-2.5" style={{ border: '2px solid var(--ink)', background: 'var(--surface-2)' }}>
          <div className="flex items-center gap-1.5">
            <ImagePlus size={13} className="text-orange-sig" />
            <span className="chip font-bold text-text-dim">现实中的它长什么样</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-text-faint">
            按你电路里的元件，画一张现实中类似物品的示意图（AI 生成，仅供参考）。
          </p>
          <button
            onClick={runImage}
            disabled={imaging || !nodes.length}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[12px] font-bold text-ink disabled:opacity-40"
            style={{ border: '2px solid var(--ink)', background: 'var(--orange)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            {imaging ? <Loader2 size={13} className="spin-slow" /> : <Sparkles size={13} />}
            {imaging ? '正在画…（约 10 秒）' : '生成实物图'}
          </button>
          {imageError && (
            <p className="mt-2 rounded-md px-2 py-1.5 text-[11.5px] text-red-sig" style={{ border: '1.5px solid var(--red)', background: 'rgba(198,107,90,0.1)' }}>
              {imageError}
            </p>
          )}
          {imageSrc && (
            <div className="mt-2">
              <img src={imageSrc} alt="AI 生成的实物示意图" className="w-full rounded-md" style={{ border: '2px solid var(--ink)' }} />
              <button
                onClick={doExportImage}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 font-mono text-[11.5px] font-bold text-text-dim"
                style={{ border: '2px solid var(--ink)', background: 'var(--surface)' }}
              >
                <Download size={12} />保存这张图
              </button>
            </div>
          )}
          {imagePrompt && !imageSrc && !imaging && !imageError && (
            <p className="mt-2 text-[10.5px] leading-relaxed text-text-faint">提示词：{imagePrompt}</p>
          )}
        </div>

        {/* 导出作品 */}
        <div className="rounded-lg p-2.5" style={{ border: '2px solid var(--ink)', background: 'rgba(107,163,195,0.1)' }}>
          <div className="flex items-center gap-1.5">
            <Download size={13} className="text-cyan-sig" />
            <span className="chip font-bold text-text-dim">导出我的作品</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-text-faint">
            导出为 JSON 文件：包含每个元件的名字、参数、位置、连线关系和一份人可读说明，方便交作业或分享。
          </p>
          <button
            onClick={doExportJson}
            disabled={!nodes.length}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[12px] font-bold text-ink disabled:opacity-40"
            style={{ border: '2px solid var(--ink)', background: 'var(--cyan)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            <Download size={13} />导出作品（JSON）
          </button>
          <button
            onClick={doSaveToZhiya}
            disabled={!nodes.length || savingZhiya}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[12px] font-bold text-ink disabled:opacity-40"
            style={{ border: '2px solid var(--ink)', background: 'var(--amber)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            {savingZhiya ? <Loader2 size={13} className="spin-slow" /> : <ClipboardCheck size={13} />}
            {savingZhiya ? '正在保存…' : '保存到智芽·我的作品'}
          </button>
          {saved && <p className="mt-2 text-[11.5px] text-green-sig">{saved}</p>}
        </div>
      </div>
    </div>
  )
}
