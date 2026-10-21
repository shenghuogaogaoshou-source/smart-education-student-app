// ============================================================
// AI 助手 —— 把"我想要一个这样的模块"变成可运行的自定义模块
//
// 后端：经智芽本地代理调用 DeepSeek；API Key 只保存在服务端。
// ============================================================
import type { DataType, ModuleCategory, ParamDef, PortDef } from '../types/circuit'
import { validateCode } from './customModules'

/** 默认连接配置（可在 localStorage 的 aicircuit.aiSettings 里覆盖） */
export const AI_DEFAULTS = {
  endpoint: '/api/deepseek/chat/completions',
  model: 'deepseek-flash',
  apiKey: '',
}

export interface AiSettings {
  endpoint: string
  model: string
  apiKey: string
}

const SETTINGS_KEY = 'aicircuit.aiSettings'
const LEGACY_DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      endpoint: typeof parsed?.endpoint === 'string' && parsed.endpoint && parsed.endpoint !== LEGACY_DEEPSEEK_ENDPOINT
        ? parsed.endpoint
        : AI_DEFAULTS.endpoint,
      model: typeof parsed?.model === 'string' && parsed.model ? parsed.model : AI_DEFAULTS.model,
      apiKey: typeof parsed?.apiKey === 'string' && parsed.apiKey ? parsed.apiKey : AI_DEFAULTS.apiKey,
    }
  } catch {
    return { ...AI_DEFAULTS }
  }
}

/** AI 生成结果：直接对应创建器里的各个字段 */
export interface AiModuleDraft {
  name: string
  subtitle: string
  category: ModuleCategory
  icon: string
  accent: string
  description: string
  explanation: string
  inputs: PortDef[]
  outputs: PortDef[]
  params: ParamDef[]
  code: string
}

export const AI_ICON_OPTIONS = ['Cpu', 'Wrench', 'FlaskConical', 'Binary', 'Calculator', 'Boxes', 'CircuitBoard', 'Puzzle']
export const AI_ACCENT_OPTIONS = ['#6ba3c3', '#d4a04a', '#8aab6e', '#d4825a', '#a888c7', '#c66b5a']
const DATA_TYPES: DataType[] = ['image', 'label', 'confidence', 'signal', 'text', 'number', 'audio']
const CATEGORIES: ModuleCategory[] = ['input', 'perception', 'logic', 'output']

/** 模块代码契约：写进系统提示，避免模型产出不能运行的代码 */
const SYSTEM_PROMPT = `你是「AI 数字电路实验室」的教学模块设计助手，服务对象是小学生。
用户会用中文描述他想要的新模块（例如"温度超过 30 度就报警"）。
你要输出一个可以直接注册到画布上的自定义模块定义，且**只输出一个 JSON 对象**，不要解释、不要 Markdown 代码围栏。

JSON 字段：
{
  "name": "英文模块名，≤14 字符，如 TempAlarm",
  "subtitle": "中文副名，≤12 字，如 温度报警",
  "category": "input | perception | logic | output 之一",
  "icon": "从这些里选一个：${AI_ICON_OPTIONS.join(' / ')}",
  "accent": "从这些颜色里选一个：${AI_ACCENT_OPTIONS.join(' / ')}",
  "description": "一句话功能说明（≤40 字）",
  "explanation": "给小学生看的解释：这块元件在做什么、为什么有用（2~3 句）",
  "inputs":  [{ "id": "小写英文id", "label": "中文标签", "type": "数据类型" }],
  "outputs": [{ "id": "小写英文id", "label": "中文标签", "type": "数据类型" }],
  "params":  [{ "id": "小写英文id", "label": "中文标签", "type": "string|number|select", "default": 默认值,
                "min": 数字(仅 number), "max": 数字(仅 number), "step": 数字(仅 number),
                "options": [{ "label": "中文", "value": "英文值" }](仅 select) }],
  "code": "求值函数体（JavaScript 字符串）"
}

数据类型只能是：image(图像) / label(标签字符串) / confidence(0~1 置信度) / signal(布尔信号) / text(文本) / number(数值) / audio(音频)。
连线的数据类型必须一致（confidence 与 number 互通）。

code 是一个函数体的源码字符串，运行环境提供两个变量：
- inputs：各输入端口当前数据包，取法 inputs.<端口id>（可能为 undefined），
  signal 包用 .active（布尔），label/text 包用 .value（字符串），confidence/number 包用 .value（数字）。
- params：参数当前值，取法 params.<参数id>。
必须 return 一个对象：{ outputs: { <输出端口id>: <数据包> }, message: "状态文案（中文）" }。
数据包形状：{ type:'signal', active:true/false } 或 { type:'label', value:'文字' } 或
{ type:'confidence', value:0.8 } 或 { type:'number', value:42 } 或 { type:'text', value:'文字' }。
outputs 的键必须与声明的 outputs[].id 完全一致，数据包的 type 必须与对应端口 type 一致。

代码约束（违反会被安全沙箱拒绝）：
1) 只用输入参数、局部变量、Math、JSON、Date、Array/String/Number 等纯计算能力；
2) 禁止出现 window、document、globalThis、self、top、parent、location、navigator、localStorage、fetch、XMLHttpRequest、eval、Function、constructor、__proto__、Image(、Audio(、Worker、WebSocket 等词；
3) 所有输入都可能缺失，先做兜底再计算；参数可能是字符串，数字参数用 Number(params.x ?? 默认值) 转换；
4) 不要抛异常，不要写副作用；代码 ≤ 25 行，可用中文注释。

示例（标签包含匹配）：
{"name":"TagFilter","subtitle":"标签筛选","category":"logic","icon":"Binary","accent":"#8aab6e","description":"标签包含目标文字时输出真信号","explanation":"它像门口的保安，只让符合条件的结果通过。","inputs":[{"id":"label","label":"标签","type":"label"}],"outputs":[{"id":"signal","label":"信号","type":"signal"}],"params":[{"id":"target","label":"目标文字","type":"string","default":""}],"code":"const label = String(inputs.label?.value ?? '')\\nconst target = String(params.target ?? '')\\nconst match = target !== '' && label.includes(target)\\nreturn { outputs: { signal: { type: 'signal', active: match } }, message: match ? '匹配成功' : '不匹配' }"}`

/** 把模型返回的文本解析成 JSON（容忍 ```json 围栏、前后多余文字） */
export function parseJsonPayload(text: string): unknown {
  const trimmed = (text || '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(body)
  } catch {
    // 退一步：截取第一个 { 到最后一个 }
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1))
      } catch {
        /* 落到下面统一报错 */
      }
    }
    throw new Error('AI 返回的内容不是有效 JSON，请换个说法再试')
  }
}

const ID_RE = /^[A-Za-z_][A-Za-z0-9_]{0,23}$/

function normalizePorts(raw: unknown): PortDef[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const ports: PortDef[] = []
  for (const item of raw) {
    const id = String((item as { id?: unknown })?.id ?? '').trim()
    const type = String((item as { type?: unknown })?.type ?? '').trim() as DataType
    if (!ID_RE.test(id) || used.has(id) || !DATA_TYPES.includes(type)) continue
    used.add(id)
    ports.push({
      id,
      label: String((item as { label?: unknown })?.label ?? id).slice(0, 12),
      type,
    })
  }
  return ports
}

function normalizeParams(raw: unknown): ParamDef[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: ParamDef[] = []
  for (const item of raw) {
    const id = String((item as { id?: unknown })?.id ?? '').trim()
    if (!ID_RE.test(id) || used.has(id)) continue
    const type = String((item as { type?: unknown })?.type ?? 'string') as ParamDef['type']
    if (!['string', 'number', 'select'].includes(type)) continue
    used.add(id)
    const def: ParamDef = {
      id,
      label: String((item as { label?: unknown })?.label ?? id).slice(0, 14),
      type,
      default: type === 'number' ? Number((item as { default?: unknown })?.default ?? 0) : String((item as { default?: unknown })?.default ?? ''),
      editable: true,
    }
    if (type === 'number') {
      if (Number.isFinite(Number((item as { min?: unknown })?.min))) def.min = Number((item as { min?: unknown }).min)
      if (Number.isFinite(Number((item as { max?: unknown })?.max))) def.max = Number((item as { max?: unknown }).max)
      if (Number.isFinite(Number((item as { step?: unknown })?.step))) def.step = Number((item as { step?: unknown }).step)
      if (def.min !== undefined && def.max !== undefined && def.min > def.max) [def.min, def.max] = [def.max, def.min]
    }
    if (type === 'select') {
      const options = Array.isArray((item as { options?: unknown })?.options)
        ? ((item as { options: unknown[] }).options
            .map((o) => ({ label: String((o as { label?: unknown })?.label ?? ''), value: String((o as { value?: unknown })?.value ?? '') }))
            .filter((o) => o.value !== ''))
        : []
      if (!options.length) continue // 没有选项的 select 没法用
      def.options = options
      if (!options.some((o) => o.value === def.default)) def.default = options[0].value
    }
    out.push(def)
  }
  return out
}

/** 校验并补全模型返回的定义；不合格直接抛中文错误 */
export function normalizeDraft(raw: unknown): AiModuleDraft {
  const obj = (raw ?? {}) as Record<string, unknown>
  const name = String(obj.name ?? '').trim().slice(0, 16)
  if (!name) throw new Error('AI 没有给出模块名称，请把需求说得更具体一点')
  const category = String(obj.category ?? 'logic') as ModuleCategory
  const code = typeof obj.code === 'string' ? obj.code : ''
  if (!code.trim()) throw new Error('AI 没有生成求值代码，请重试')

  const safe = validateCode(code)
  if (!safe.ok) throw new Error(`AI 生成的代码没通过安全检查（${safe.reason ?? '含危险调用'}），请换个说法重试`)

  const inputs = normalizePorts(obj.inputs)
  const outputs = normalizePorts(obj.outputs)
  if (outputs.length === 0) throw new Error('AI 生成的模块没有输出端口，请明确"它要输出什么"')

  return {
    name,
    subtitle: String(obj.subtitle ?? name).trim().slice(0, 12),
    category: CATEGORIES.includes(category) ? category : 'logic',
    icon: AI_ICON_OPTIONS.includes(String(obj.icon)) ? String(obj.icon) : 'Boxes',
    accent: AI_ACCENT_OPTIONS.includes(String(obj.accent)) ? String(obj.accent) : '#a888c7',
    description: String(obj.description ?? '').trim().slice(0, 60) || 'AI 生成的模块',
    explanation: String(obj.explanation ?? '').trim(),
    inputs,
    outputs,
    params: normalizeParams(obj.params),
    code,
  }
}

/** 调用大模型，把一句话需求变成模块定义 */
export async function generateModuleDraft(requirement: string, timeoutMs = 60000): Promise<AiModuleDraft> {
  const text = requirement.trim()
  if (!text) throw new Error('先说说你想要一个什么样的模块')

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
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `我要的模块是：${text}` },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`AI 接口返回 ${res.status}：${detail.slice(0, 160) || '请稍后重试'}`)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) throw new Error('AI 没有返回内容，请重试')
    return normalizeDraft(parseJsonPayload(content))
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('AI 生成超时（60 秒），请重试或把需求说得更简单')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
