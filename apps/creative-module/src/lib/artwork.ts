// ============================================================
// 作品检查与导出 —— 电路自检 / AI 审查 / 实物图生成 / 导出
//
// 两个后端：
//   1) 文本检查：DeepSeek（复用自定义模块助手的 Key 与配置）
//   2) 实物图：火山方舟 Ark · doubao-seedream 文生图
// 两个能力都经智芽本地代理调用，Key 只保存在服务端。
// ============================================================
import type { Edge, Node } from 'reactflow'
import { getModule } from './moduleRegistry'
import { loadAiSettings } from './aiAssistant'
import type { CircuitNodeData, DataType } from '../types/circuit'

// -------------------- 实物图（火山方舟） --------------------
export const IMAGE_API_DEFAULTS = {
  endpoint: '/api/ark/images/generations',
  model: 'doubao-seedream-4-0-20260415',
  size: '2048x2048',
  // 老模型兜底：主模型不可用时换这个重试
  fallbackModel: 'doubao-seedream-4-0-250828',
  apiKey: '',
}

export interface ImageSettings {
  endpoint: string
  model: string
  apiKey: string
}

const IMAGE_SETTINGS_KEY = 'aicircuit.imageSettings'
const LEGACY_IMAGE_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'

export function loadImageSettings(): ImageSettings {
  try {
    const raw = localStorage.getItem(IMAGE_SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      endpoint: typeof parsed?.endpoint === 'string' && parsed.endpoint && parsed.endpoint !== LEGACY_IMAGE_ENDPOINT
        ? parsed.endpoint
        : IMAGE_API_DEFAULTS.endpoint,
      model: typeof parsed?.model === 'string' && parsed.model ? parsed.model : IMAGE_API_DEFAULTS.model,
      apiKey: typeof parsed?.apiKey === 'string' && parsed.apiKey ? parsed.apiKey : IMAGE_API_DEFAULTS.apiKey,
    }
  } catch {
    return { ...IMAGE_API_DEFAULTS }
  }
}

// -------------------- 检查结果类型 --------------------
export type IssueSeverity = 'error' | 'warning' | 'tip'
export interface ArtworkIssue {
  severity: IssueSeverity
  title: string
  detail: string
  fix?: string
  /** 来源：本机结构检查 / AI 审查 */
  from: 'local' | 'ai'
}

export interface CircuitSummary {
  moduleCount: number
  edgeCount: number
  modules: {
    id: string
    type: string
    name: string
    subtitle: string
    params: Record<string, string | number>
    connectedInputs: string[]
  }[]
  links: { fromName: string; fromPort: string; toName: string; toPort: string; type: string }[]
  /** 给大模型看的纯文本描述 */
  text: string
}

const typeLabel: Record<DataType, string> = {
  image: '图像',
  label: '标签',
  confidence: '置信度',
  signal: '信号',
  text: '文本',
  number: '数值',
  audio: '音频',
}

function portLabel(type: string, portId: string | null | undefined): string {
  if (!portId) return '?'
  const mod = getModule(type)
  const p = mod?.inputs.find((x) => x.id === portId) ?? mod?.outputs.find((x) => x.id === portId)
  return p ? `${p.label}${typeLabel[p.type] ? `(${typeLabel[p.type]})` : ''}` : portId
}

/** 把画布上的电路整理成可读摘要（也是导出内容的一部分） */
export function summarizeCircuit(
  nodes: Node<CircuitNodeData>[],
  edges: Edge[],
): CircuitSummary {
  const modules = nodes.map((n) => {
    const mod = getModule(n.data.moduleType)
    return {
      id: n.id,
      type: n.data.moduleType,
      name: mod?.name ?? n.data.moduleType,
      subtitle: mod?.subtitle ?? '',
      params: { ...n.data.params },
      connectedInputs: edges
        .filter((e) => e.target === n.id && e.targetHandle)
        .map((e) => e.targetHandle as string),
    }
  })

  const links = edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source)
    const tgt = nodes.find((n) => n.id === e.target)
    return {
      fromName: src ? (getModule(src.data.moduleType)?.name ?? src.data.moduleType) : e.source,
      fromPort: src ? portLabel(src.data.moduleType, e.sourceHandle) : String(e.sourceHandle ?? ''),
      toName: tgt ? (getModule(tgt.data.moduleType)?.name ?? tgt.data.moduleType) : e.target,
      toPort: tgt ? portLabel(tgt.data.moduleType, e.targetHandle) : String(e.targetHandle ?? ''),
      type: String((e.data as { fromType?: string })?.fromType ?? ''),
    }
  })

  const lines: string[] = []
  lines.push(`元件 ${nodes.length} 个，连线 ${edges.length} 条。`)
  lines.push('元件清单：')
  for (const m of modules) {
    const paramText = Object.entries(m.params)
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v : JSON.stringify(v)}`)
      .join('，')
    lines.push(`- ${m.name}${m.subtitle ? `（${m.subtitle}）` : ''} [type=${m.type}] 参数：${paramText || '无'}`)
  }
  lines.push('连线：')
  if (!links.length) lines.push('- 没有任何连线')
  for (const l of links) {
    lines.push(`- ${l.fromName}.${l.fromPort} → ${l.toName}.${l.toPort}（${l.type}）`)
  }
  lines.push(`（元件名字对照：${modules.map((m) => `${m.name}→${m.id}`).join('，')}；上面用的都是名字）`)

  return {
    moduleCount: nodes.length,
    edgeCount: edges.length,
    modules,
    links,
    text: lines.join('\n'),
  }
}

/** 本机结构自检：不联网、立刻能给出确定性问题 */
export function localCheck(nodes: Node<CircuitNodeData>[], edges: Edge[]): ArtworkIssue[] {
  const issues: ArtworkIssue[] = []
  if (!nodes.length) {
    issues.push({
      severity: 'error',
      title: '画布是空的',
      detail: '还没有任何元件，先搭一条链路再检查。',
      fix: '从「AI 模块市场」添加元件，或点「加载示例链路」。',
      from: 'local',
    })
    return issues
  }

  // 1. 必备入端没接线
  for (const n of nodes) {
    const mod = getModule(n.data.moduleType)
    if (!mod) continue
    const missing = mod.inputs.filter(
      (p) => !p.optional && !edges.some((e) => e.target === n.id && e.targetHandle === p.id),
    )
    if (missing.length) {
      issues.push({
        severity: 'warning',
        title: `${mod.name} 的输入没接满`,
        detail: `「${missing.map((p) => p.label).join('、')}」没有连线，这个元件永远不会被触发。`,
        fix: `把能输出${missing.map((p) => typeLabel[p.type]).join('/')}的元件接到它的${missing.length > 1 ? '这些' : '这个'}端口上。`,
        from: 'local',
      })
    }
  }

  // 2. IF 目标标签为空（默认陷阱：空串永远不匹配）
  for (const n of nodes) {
    if (n.data.moduleType !== 'if') continue
    const target = String(n.data.params.targetLabel ?? '').trim()
    if (!target) {
      issues.push({
        severity: 'error',
        title: 'IF 没有设置目标标签',
        detail: '目标标签是空串时，任何标签都不会匹配，IF 的信号永远是 FALSE。',
        fix: '长按 IF 元件打开检视器，把「当标签包含」填成 AI 会输出的词（如 暗 / 亮 / 垃圾）。',
        from: 'local',
      })
    } else {
      issues.push({
        severity: 'tip',
        title: `IF 的目标是「${target}」`,
        detail: `要确认上游 AI 真的会输出「${target}」这个标签，否则信号一直是 FALSE。`,
        from: 'local',
      })
    }
  }

  // 3. 孤立元件（没有任何连线）
  const isolated = nodes.filter(
    (n) => !edges.some((e) => e.source === n.id || e.target === n.id),
  )
  for (const n of isolated) {
    const mod = getModule(n.data.moduleType)
    issues.push({
      severity: 'warning',
      title: `${mod?.name ?? n.data.moduleType} 没有连线`,
      detail: '孤立的元件不会参与数据流动。',
      fix: '把它接进主链路，或者删掉。',
      from: 'local',
    })
  }

  // 4. 没有终端（结果看不见）
  const terminalTypes = ['output', 'ledIndicator', 'buzzer', 'ttsPlayer', 'textDisplay', 'numberDisplay']
  if (!nodes.some((n) => terminalTypes.includes(n.data.moduleType))) {
    issues.push({
      severity: 'tip',
      title: '没有可见的结果输出',
      detail: '链路最后没有灯泡/指示灯/文字显示/数值仪表，运行时看不到 AI 的判断结果。',
      fix: '在链路末端加一个「灯泡输出」或「文字显示」。',
      from: 'local',
    })
  }

  // 5. 环形依赖
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    adj.get(e.source)!.push(e.target)
  }
  const state = new Map<string, 0 | 1 | 2>()
  let cycle: string[] | null = null
  const dfs = (id: string, stack: string[]): boolean => {
    const s = state.get(id) ?? 0
    if (s === 1) {
      cycle = [...stack.slice(stack.indexOf(id)), id]
      return true
    }
    if (s === 2) return false
    state.set(id, 1)
    for (const next of adj.get(id) ?? []) {
      if (dfs(next, [...stack, id])) return true
    }
    state.set(id, 2)
    return false
  }
  for (const n of nodes) {
    if (dfs(n.id, [])) break
  }
  if (cycle) {
    issues.push({
      severity: 'error',
      title: '电路里有环',
      detail: `数据会绕回自己（${(cycle as string[]).map((id) => nodes.find((n) => n.id === id)?.data.moduleType ?? id).join(' → ')}），求值可能反复触发。`,
      fix: '断开环上的一条连线，让数据流保持单向。',
      from: 'local',
    })
  }

  return issues
}

/** 按元件把电路翻译成现实设备（用于生成实物图的提示词） */
const REAL_WORLD: Record<string, string> = {
  camera: '摄像头（视觉输入）',
  microphone: '麦克风（声音输入）',
  imageInput: '图像输入',
  textInput: '按键/键盘输入',
  imageClassifier: '光线传感器',
  objectDetection: 'AI 视觉识别模组',
  speechRecognition: '语音识别模组',
  soundClassification: '声音分类模组',
  volumeDetector: '声音传感器',
  trashClassifier: 'AI 垃圾分类模组',
  sceneCamera: '监控摄像头',
  if: '控制主板（条件判断）',
  and: '与门逻辑芯片',
  or: '或门逻辑芯片',
  not: '非门逻辑芯片',
  timer: '定时器模块',
  counter: '计数器模块',
  delayTimer: '延时继电器',
  textMerge: '文本处理芯片',
  output: '继电器 + 灯泡',
  ledIndicator: 'LED 指示灯',
  buzzer: '蜂鸣器',
  ttsPlayer: '小喇叭',
  textDisplay: '小屏幕',
  numberDisplay: '数字显示仪表',
  roboticArm: '机械臂',
}

/** 生成给文生图模型的中文描述 */
export function buildProductPrompt(nodes: Node<CircuitNodeData>[], title?: string): string {
  const parts = new Set<string>()
  for (const n of nodes) {
    const mod = getModule(n.data.moduleType)
    if (mod) parts.add(REAL_WORLD[n.data.moduleType] ?? mod.name)
  }
  const device = [...parts].join('、') || '一个 AI 电子装置'
  const name = title?.trim() || '一个小发明'
  return (
    `一个现实世界中真实存在的小型电子装置，它是「${name}」，核心部件包括：${device}。` +
    '整体造型可爱、圆润、适合儿童，外壳有电路板和传感器细节，' +
    '浅色背景，干净的儿童科普绘本/工业设计渲染风格，正面 3/4 视角，光线柔和，画面里不要出现文字。'
  )
}

// -------------------- AI 审查（DeepSeek） --------------------
const CHECK_SYSTEM_PROMPT = `你是「AI 数字电路实验室」的电路审查老师，服务对象是小学生。
用户会给你一条电路的元件与连线清单。请你判断这条电路能不能正常工作、有没有 bug，并给出修改建议。
只输出一个 JSON 对象，不要解释、不要 Markdown：
{
  "score": 0-100 的整数（这条电路的可用程度）,
  "summary": "一句话总评（≤40字，中文，小学生能懂）",
  "issues": [
    { "severity": "error|warning|tip", "title": "≤16字", "detail": "问题说明（≤60字）", "fix": "怎么改（≤60字）" }
  ]
}
判断依据（按重要性）：
1. 连线类型是否匹配、必需输入是否都接上；
2. 条件判断（IF）的目标标签是否与上游 AI 实际会输出的标签一致；
3. 有没有形成完整的数据通路（输入 → 处理 → 输出），末端能不能看出结果；
4. 参数取值是否合理（阈值、频率、目标值等）；
5. 是否有环形连接、孤立元件、重复冗余。
issues 最多 6 条，按严重程度排序；没有问题就返回空数组并给高分。`

export interface AiCheckResult {
  score: number
  summary: string
  issues: ArtworkIssue[]
}

/** 让大模型审查电路（复用自定义模块助手的 Key 配置） */
export async function aiCheckCircuit(
  nodes: Node<CircuitNodeData>[],
  edges: Edge[],
  timeoutMs = 60000,
): Promise<AiCheckResult> {
  const summary = summarizeCircuit(nodes, edges)
  const localIssues = localCheck(nodes, edges)
  const { endpoint, model, apiKey } = loadAiSettings()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CHECK_SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              summary.text +
              '\n\n（本机结构检查已经发现的问题，可参考但不要重复堆砌：\n' +
              (localIssues.length
                ? localIssues.map((i) => `- [${i.severity}] ${i.title}：${i.detail}`).join('\n')
                : '无') +
              '）',
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`审查接口返回 ${res.status}：${detail.slice(0, 160) || '请稍后重试'}`)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''
    return normalizeAiCheck(content)
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('AI 审查超时（60 秒），请重试')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function normalizeAiCheck(content: string): AiCheckResult {
  const text = (content || '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1].trim() : text
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    const s = body.indexOf('{')
    const e = body.lastIndexOf('}')
    if (s < 0 || e <= s) throw new Error('AI 审查返回的不是有效 JSON，请重试')
    raw = JSON.parse(body.slice(s, e + 1))
  }
  const obj = raw as Record<string, unknown>
  const issuesRaw = Array.isArray(obj.issues) ? obj.issues : []
  const issues: ArtworkIssue[] = issuesRaw.slice(0, 8).map((it) => {
    const i = (it ?? {}) as Record<string, unknown>
    const sev = String(i.severity ?? 'tip')
    return {
      severity: sev === 'error' || sev === 'warning' ? sev : 'tip',
      title: String(i.title ?? '问题').slice(0, 24),
      detail: String(i.detail ?? '').slice(0, 160),
      fix: i.fix ? String(i.fix).slice(0, 160) : undefined,
      from: 'ai',
    }
  })
  const scoreNum = Number(obj.score)
  return {
    score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 60,
    summary: String(obj.summary ?? '').slice(0, 80) || 'AI 已完成审查',
    issues,
  }
}

// -------------------- 实物图生成（火山方舟） --------------------
export function describeProductImageError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/abort|timeout|超时/i.test(message)) {
    return '实物图等得有点久，作品还在，请检查网络后再试一次。'
  }
  if (/没有返回图片|JSON|格式/i.test(message)) {
    return '图片服务这次没有送回完整图片，作品还在，可以再次生成。'
  }
  return '图片服务正在休息，作品还在，请稍后再试一次。'
}

export async function generateProductImage(prompt: string, timeoutMs = 120000): Promise<string> {
  const { endpoint, model, apiKey } = loadImageSettings()
  const body = (m: string) =>
    JSON.stringify({
      model: m,
      prompt,
      size: IMAGE_API_DEFAULTS.size,
      response_format: 'b64_json',
      watermark: false,
    })

  const attempt = async (m: string): Promise<string> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: body(m),
        signal: controller.signal,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`出图接口返回 ${res.status}：${text.slice(0, 160)}`)
      const json = JSON.parse(text) as { data?: { b64_json?: string; url?: string }[] }
      const item = json.data?.[0]
      if (item?.b64_json) return `data:image/jpeg;base64,${item.b64_json}`
      if (item?.url) return item.url
      throw new Error('出图接口没有返回图片')
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new Error('出图超时（120 秒），请重试')
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    return await attempt(model)
  } catch (err) {
    // 主模型不可用（比如账号未开通）时，换兜底模型再试一次
    if (model !== IMAGE_API_DEFAULTS.fallbackModel) {
      try {
        return await attempt(IMAGE_API_DEFAULTS.fallbackModel)
      } catch {
        throw new Error(describeProductImageError(err))
      }
    }
    throw new Error(describeProductImageError(err))
  }
}

// -------------------- 导出 --------------------
export interface ArtworkExport {
  app: string
  version: 2
  exportedAt: string
  moduleCount: number
  edgeCount: number
  nodes: { id: string; type: string; name: string; subtitle: string; position: { x: number; y: number }; params: Record<string, string | number> }[]
  edges: { from: string; fromPort: string; to: string; toPort: string; dataType: string }[]
  /** 人可读的说明（给老师/家长看） */
  summaryText: string
}

/** 组装导出数据（不含摄像头画面、不含推理结果） */
export function buildExport(
  nodes: Node<CircuitNodeData>[],
  edges: Edge[],
  title?: string,
): ArtworkExport {
  const summary = summarizeCircuit(nodes, edges)
  return {
    app: 'AI Circuit Lab',
    version: 2,
    exportedAt: new Date().toISOString(),
    moduleCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map((n) => {
      const mod = getModule(n.data.moduleType)
      return {
        id: n.id,
        type: n.data.moduleType,
        name: mod?.name ?? n.data.moduleType,
        subtitle: mod?.subtitle ?? '',
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        params: { ...n.data.params },
      }
    }),
    edges: edges.map((e) => ({
      from: e.source,
      fromPort: String(e.sourceHandle ?? ''),
      to: e.target,
      toPort: String(e.targetHandle ?? ''),
      dataType: String((e.data as { fromType?: string })?.fromType ?? ''),
    })),
    summaryText: (title ? `作品：${title}\n` : '') + summary.text,
  }
}

export function downloadText(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 导出图片（data URL 或 http(s) 链接都能处理） */
export async function downloadImage(filename: string, src: string) {
  if (src.startsWith('data:')) {
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  // 远程图片先取回再下载，避免跨域直接跳转
  const res = await fetch(src)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
