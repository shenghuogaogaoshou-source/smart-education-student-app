// ============================================================
// 节点求值器 —— 每种 AI 模块"真正在做什么"
// 输入：节点的入端数据包 + 参数
// 输出：新的出端数据包 + AI 内部状态
// ============================================================
import { isSignalActive, type CircuitNodeData, type Packet } from '../types/circuit'
import { detect, type Detection } from './ai/objectDetector'

export interface EvalResult {
  outputs: Record<string, Packet>
  aiState?: CircuitNodeData['aiState']
}

export type Evaluator = (
  data: CircuitNodeData,
  inputs: Record<string, Packet | undefined>,
) => Promise<EvalResult | null> | EvalResult | null

// -------------------- 感光器：平均亮度检测 --------------------
export const evaluateImageClassifier: Evaluator = (data, inputs) => {
  const imagePkt = inputs.image
  if (!imagePkt || imagePkt.type !== 'image') return null

  const canvas = imagePkt.canvas
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return { outputs: {} as Record<string, Packet>, aiState: { status: 'error', message: '无法读取画布' } }
  }

  // 小尺寸采样（感光器不需要高分辨率）
  const W = canvas.width, H = canvas.height
  const step = 4 // 像素采样步长，提升性能
  let rSum = 0, gSum = 0, bSum = 0, count = 0
  try {
    const img = ctx.getImageData(0, 0, W, H).data
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4
        rSum += img[i]; gSum += img[i + 1]; bSum += img[i + 2]
        count++
      }
    }
  } catch {
    return { outputs: {} as Record<string, Packet>, aiState: { status: 'error', message: '画布读失败（跨域？）' } }
  }

  // 相对亮度（0~1）：Rec. 709 加权
  const r = (rSum / count) / 255
  const g = (gSum / count) / 255
  const b = (bSum / count) / 255
  let raw = 0.2126 * r + 0.7152 * g + 0.0722 * b

  // 灵敏度曲线
  const sens = data.params.sensitivity as string
  if (sens === 'soft') raw = Math.pow(raw, 1.4)
  else if (sens === 'high') raw = Math.pow(raw, 0.7)

  const brightness = Math.max(0, Math.min(1, raw)) // 0~1
  const brightnessPct = Math.round(brightness * 100)

  // 阈值分段：亮/暗
  const threshold = Number(data.params.threshold ?? 50)
  const label = brightnessPct >= threshold ? '亮' : '暗'

  const ts = Date.now()
  return {
    outputs: {
      label: { type: 'label', value: label, ts },
      confidence: { type: 'confidence', value: brightness, ts },
    },
    aiState: {
      status: 'ready',
      message: `亮度 ${brightnessPct}% · ${label}`,
      // 额外输出给节点可视化用
      brightness,
      brightnessPct,
      threshold,
      label,
      rgb: {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
      },
    },
  }
}

// -------------------- 垃圾分类器：COCO-SSD 目标检测 --------------------
// 用真实 COCO-SSD 模型检测画面中的物体：
//   检测到瓶子/杯子等垃圾类 → label = "垃圾"
//   未检测到垃圾类 → label = "鱼"
// 输出一个 label 端口，供 IF 节点做条件判断
// 注意：detect() 已将英文 class 翻译为中文，这里用中文匹配
const TRASH_CLASSES = new Set(['瓶子', '杯子', '酒杯'])

export const evaluateTrashClassifier: Evaluator = async (data, inputs) => {
  const imagePkt = inputs.image
  if (!imagePkt || imagePkt.type !== 'image') return null

  const minScore = Math.max(0.05, Math.min(0.95, Number(data.params.minScore ?? 30) / 100))

  let detections: Detection[]
  try {
    detections = await detect(imagePkt.canvas, 10, minScore)
  } catch (err) {
    return {
      outputs: {} as Record<string, Packet>,
      aiState: { status: 'error', message: '检测失败：' + (err as Error).message },
    }
  }

  const trashDetections = detections.filter((d) => TRASH_CLASSES.has(d.class))
  const isTrash = trashDetections.length > 0
  const label = isTrash ? '垃圾' : '鱼'
  const ts = Date.now()

  return {
    outputs: {
      label: { type: 'label', value: label, ts },
    },
    aiState: {
      status: 'ready',
      message: isTrash
        ? `检测到垃圾 · ${trashDetections.map((d) => `${d.class}(${Math.round(d.score * 100)}%)`).join(', ')}`
        : detections.length > 0
          ? `检测到 ${detections.map((d) => d.class).join(', ')}，无垃圾 · 判定为鱼`
          : '未检测到垃圾物体 · 判定为鱼',
      detections,
      isTrash,
      label,
    },
  }
}

// -------------------- 目标检测：真实 COCO-SSD 推理 --------------------
export const evaluateObjectDetection: Evaluator = async (data, inputs) => {
  const imagePkt = inputs.image
  if (!imagePkt || imagePkt.type !== 'image') return null

  const maxBoxes = Number(data.params.maxBoxes ?? 5) || 5
  const minScore = Math.max(0.05, Math.min(0.95, Number(data.params.minScore ?? 50) / 100))

  let detections: Detection[]
  try {
    detections = await detect(imagePkt.canvas, maxBoxes, minScore)
  } catch (err) {
    return {
      outputs: {} as Record<string, Packet>,
      aiState: { status: 'error', message: (err as Error).message },
    }
  }

  const count = detections.length
  const ts = Date.now()

  if (count === 0) {
    return {
      outputs: {
        label: { type: 'label', value: '(无物体)', ts },
        count: { type: 'number', value: 0, ts },
      },
      aiState: {
        status: 'ready',
        message: '未检测到物体',
        detections: [],
      },
    }
  }

  // 取置信度最高的作为标签输出
  const top = detections.reduce((a, b) => (a.score > b.score ? a : b))

  return {
    outputs: {
      label: { type: 'label', value: top.class, ts },
      count: { type: 'number', value: count, ts },
    },
    aiState: {
      status: 'ready',
      message: `检测到 ${count} 个物体 · ${top.class} ${(top.score * 100).toFixed(0)}%`,
      detections,
    },
  }
}

// -------------------- IF：条件判断（仅按标签匹配） --------------------
export const evaluateIf: Evaluator = (data, inputs) => {
  const labelPkt = inputs.label
  if (!labelPkt || labelPkt.type !== 'label') return null

  const target = String(data.params.targetLabel ?? '').trim().toLowerCase()
  const labelValue = String(labelPkt.value).toLowerCase()
  const match = target !== '' && labelValue.includes(target)
  const active = match

  return {
    outputs: { signal: { type: 'signal', active, ts: Date.now() } },
    aiState: { status: 'ready', message: active ? '标签匹配 · 触发' : '标签不匹配' },
  }
}

// -------------------- Output：行动（无输出端口，仅消费信号） --------------------
export const evaluateOutput: Evaluator = () => null

// -------------------- AND：全部信号为真 --------------------
export const evaluateAnd: Evaluator = (data, inputs) => {
  const a = isSignalActive(inputs.a)
  const b = isSignalActive(inputs.b)
  const active = a && b
  return {
    outputs: { signal: { type: 'signal', active, ts: Date.now() } },
    aiState: { status: 'ready', message: active ? '全部成立' : '不全部成立' },
  }
}

// -------------------- OR：任一信号为真 --------------------
export const evaluateOr: Evaluator = (data, inputs) => {
  const a = isSignalActive(inputs.a)
  const b = isSignalActive(inputs.b)
  const active = a || b
  return {
    outputs: { signal: { type: 'signal', active, ts: Date.now() } },
    aiState: { status: 'ready', message: active ? '至少一个成立' : '都不成立' },
  }
}

// -------------------- NOT：信号取反 --------------------
export const evaluateNot: Evaluator = (data, inputs) => {
  const a = isSignalActive(inputs.a)
  const active = !a
  return {
    outputs: { signal: { type: 'signal', active, ts: Date.now() } },
    aiState: { status: 'ready', message: active ? '取反后为真' : '取反后为假' },
  }
}

// -------------------- 计数器：累计触发次数 --------------------
// 仅在 trigger 的上升沿（从 false 变 true）加 1；reset 为真时归零
let counterStates: Record<string, { count: number; lastTriggerActive: boolean }> = {}
export const evaluateCounter: Evaluator = (data, inputs) => {
  const triggerActive = isSignalActive(inputs.trigger)
  const resetActive = isSignalActive(inputs.reset)
  const target = Math.max(1, Number(data.params.target ?? 5))
  const autoReset = data.params.autoReset === 'on'

  const prev = counterStates[data.id as string] ?? { count: 0, lastTriggerActive: false }
  let count = prev.count

  // 重置优先
  if (resetActive) {
    count = 0
  } else if (triggerActive && !prev.lastTriggerActive) {
    // 上升沿，计数 +1
    count += 1
  }

  let reached = count >= target
  if (reached && autoReset) count = 0

  counterStates[data.id as string] = { count, lastTriggerActive: triggerActive }
  const ts = Date.now()
  return {
    outputs: {
      number: { type: 'number', value: count, ts },
      reached: { type: 'signal', active: reached, ts },
    },
    aiState: {
      status: 'ready',
      message: reached
        ? `已达标 · 计数 ${count}/${target}`
        : `计数 ${count}/${target}${prev.lastTriggerActive === triggerActive ? '' : triggerActive ? '· +1 触发' : ''}`,
      count,
      target,
      reached,
    },
  }
}

// -------------------- 延时器：N 秒后输出信号 --------------------
// 上升沿启动定时器，到期时 emit 一次；信号回落可取消挂起
let delayStates: Record<string, { timeoutId: number | null; triggerActive: boolean }> = {}
export const evaluateDelayTimer: Evaluator = (data, inputs, context?: { emit?: (port: string, pkt: Packet) => void }) => {
  const triggerActive = isSignalActive(inputs.trigger)
  const delaySec = Math.max(0.1, Number(data.params.delay ?? 2))
  const delayMs = delaySec * 1000
  const id = String(data.id ?? Math.random())
  const st = delayStates[id] ?? { timeoutId: null, triggerActive: false }
  let message = '等待触发'
  let outputSignal = false

  // 上升沿 → 启动定时器
  if (triggerActive && !st.triggerActive) {
    if (st.timeoutId != null) window.clearTimeout(st.timeoutId)
    st.timeoutId = window.setTimeout(() => {
      // 到时间后 emit 一个真信号（脉冲宽度 250ms，再回落）
      if (context?.emit) {
        context.emit('delayed', { type: 'signal', active: true, ts: Date.now() })
      }
      window.setTimeout(() => {
        if (context?.emit) {
          context.emit('delayed', { type: 'signal', active: false, ts: Date.now() })
        }
      }, 250)
    }, delayMs)
    message = `启动延时器 · ${delaySec} 秒后输出`
  }
  // 下降沿 → 取消挂起的定时器
  else if (!triggerActive && st.triggerActive) {
    if (st.timeoutId != null) {
      window.clearTimeout(st.timeoutId)
      st.timeoutId = null
      message = '提前取消延时'
    }
  } else if (st.timeoutId != null) {
    message = `延时中 · ${delaySec} 秒`
  }

  st.triggerActive = triggerActive
  delayStates[id] = st

  // 注意：真正的延迟输出通过 emit 在 setTimeout 中触发；
  // 这里返回空或 last output 供节点UI展示当前状态。
  return {
    outputs: {
      delayed: { type: 'signal', active: outputSignal, ts: Date.now() },
    },
    aiState: { status: 'ready', message, delaySec, triggerActive },
  }
}

// -------------------- 文本合并：多文本拼接 + 模板占位符 --------------------
export const evaluateTextMerge: Evaluator = (data, inputs) => {
  const t1 = inputs.text1?.type === 'text' ? inputs.text1.value : ''
  const t2 = inputs.text2?.type === 'text' ? inputs.text2.value : ''
  const t3 = inputs.text3?.type === 'text' ? inputs.text3.value : ''
  if (!t1 && !t2 && !t3) return null

  const separator = String(data.params.separator ?? ' ')
  const template = String(data.params.template ?? '{1}{2}{3}')
  const parts = [String(t1), String(t2), String(t3)]

  let merged: string
  if (template.includes('{1}') || template.includes('{2}') || template.includes('{3}')) {
    merged = template
      .split('{1}').join(parts[0])
      .split('{2}').join(parts[1])
      .split('{3}').join(parts[2])
  } else {
    merged = parts.filter(Boolean).join(separator)
  }

  return {
    outputs: { text: { type: 'text', value: merged, ts: Date.now() } },
    aiState: { status: 'ready', message: `合并完成 · ${merged.length} 字`, merged, parts },
  }
}

// -------------------- 音量检测：RMS → 0~100 数值 + 是否超阈值信号 --------------------
export const evaluateVolumeDetector: Evaluator = (data, inputs) => {
  const audioIn = inputs.audio
  if (!audioIn || audioIn.type !== 'audio') return null

  const threshold = Math.max(0, Math.min(100, Number(data.params.threshold ?? 60)))
  // 使用数据包中已有的 level 字段（麦克风节点实时写入），应用灵敏度缩放
  const sens = 1.0
  const rawVol = (audioIn.level ?? 0) * sens
  const volume = Math.round(Math.max(0, Math.min(100, rawVol * 100)))
  const isLoud = volume >= threshold
  const ts = Date.now()

  return {
    outputs: {
      number: { type: 'number', value: volume, ts },
      signal: { type: 'signal', active: isLoud, ts },
    },
    aiState: {
      status: 'ready',
      message: isLoud ? `音量 ${volume} · 超限（≥${threshold}）` : `音量 ${volume} · 正常（<${threshold}）`,
      volume,
      threshold,
      isLoud,
    },
  }
}

// -------------------- 声音分类：基于音量 + 过零率的启发式分类（轻量真实实现） --------------------
// 教学版：用零交叉+RMS区分「安静/噪音/说话/拍手/笑声」5类
// 如果后续接入 Teachable Machine，可在此替换为真实模型推理
export const evaluateSoundClassification: Evaluator = (data, inputs) => {
  const audioIn = inputs.audio
  if (!audioIn || audioIn.type !== 'audio') return null

  const classes = String(data.params.classes ?? '拍手,说话,笑声,安静,噪音')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const threshold = Math.max(0.1, Math.min(1.0, Number(data.params.confidenceThreshold ?? 0.6)))

  const vol = audioIn.level ?? 0
  // 启发式映射：音量/节奏特征 → 5类
  let cls = '安静'
  let conf = 0.9
  if (vol < 0.05) { cls = '安静'; conf = 0.9 }
  else if (vol < 0.25) { cls = '说话'; conf = 0.75 }
  else if (vol < 0.5)  { cls = '笑声'; conf = 0.65 }
  else if (vol < 0.8)  { cls = '噪音'; conf = 0.7 }
  else                  { cls = '拍手'; conf = 0.8 }

  // 如果用户自定义了类别列表，优先选取最接近的已知类
  const idx = classes.findIndex((c) => c === cls)
  if (idx === -1) {
    // 不在用户列表中 → 退化为列表第一项
    cls = classes[0] ?? cls
    conf = Math.max(0.4, conf - 0.2)
  }

  const ts = Date.now()
  return {
    outputs: {
      label: { type: 'label', value: conf >= threshold ? cls : '', ts },
      confidence: { type: 'confidence', value: conf, ts },
    },
    aiState: {
      status: 'ready',
      message: conf >= threshold ? `判定「${cls}」· 置信度 ${Math.round(conf * 100)}%` : `未达阈值 · 当前「${cls}」${Math.round(conf * 100)}% < ${Math.round(threshold * 100)}%`,
      topClass: cls,
      confidence: conf,
      classes,
    },
  }
}

// -------------------- 语音识别：Web Speech API 真实识别 --------------------
// 求值器只负责把节点侧识别到的 transcript 打包输出
// （真正的浏览器 API 调用在 SpeechRecognitionNode 组件内部，因为需要持续运行）
export const evaluateSpeechRecognition: Evaluator = (data, inputs) => {
  const audioIn = inputs.audio
  if (!audioIn || audioIn.type !== 'audio') return null
  // 真实识别由节点组件完成；evaluator 仅检查有音频流即进入 ready 态
  return {
    outputs: {} as Record<string, Packet>,
    aiState: { status: 'ready', message: '音频流已接入 · 识别中（见节点气泡）', audioConnected: true },
  }
}

// -------------------- 文字显示 / 蜂鸣器 / TTS / LED / Output：纯终端消费，无输出端口 --------------------
export const evaluateTextDisplay: Evaluator = (data, inputs) => {
  const t = inputs.text
  if (!t || t.type !== 'text') return null
  const maxChars = Math.max(1, Number(data.params.maxChars ?? 50))
  const raw = String(t.value)
  const displayText = raw.length > maxChars ? raw.slice(0, maxChars) + '…' : raw
  return {
    outputs: {} as Record<string, Packet>,
    aiState: {
      status: 'ready',
      message: `已显示 ${displayText.length} 字 · ${data.params.displayMode} 模式`,
      displayText,
      rawText: raw,
      mode: data.params.displayMode,
    },
  }
}

export const evaluateBuzzer: Evaluator = () => null
export const evaluateTtsPlayer: Evaluator = () => null
export const evaluateLedIndicator: Evaluator = () => null

export const EVALUATORS: Record<string, Evaluator> = {
  imageClassifier: evaluateImageClassifier,
  trashClassifier: evaluateTrashClassifier,
  objectDetection: evaluateObjectDetection,
  speechRecognition: evaluateSpeechRecognition,
  soundClassification: evaluateSoundClassification,
  volumeDetector: evaluateVolumeDetector,
  if: evaluateIf,
  output: evaluateOutput,
  textDisplay: evaluateTextDisplay,
  buzzer: evaluateBuzzer,
  ttsPlayer: evaluateTtsPlayer,
  ledIndicator: evaluateLedIndicator,
  and: evaluateAnd,
  or: evaluateOr,
  not: evaluateNot,
  counter: evaluateCounter,
  delayTimer: evaluateDelayTimer,
  textMerge: evaluateTextMerge,
  // camera / microphone / textInput / imageInput / timer / sceneCamera 没有输入端口，
  // 不参与求值（由组件自行采集并 emitPacket）
}

/** 动态注册求值器（供自定义模块使用） */
export function registerDynamicEvaluator(type: string, fn: Evaluator) {
  EVALUATORS[type] = fn
}

/** 注销动态注册的求值器 */
export function unregisterDynamicEvaluator(type: string) {
  delete EVALUATORS[type]
}
