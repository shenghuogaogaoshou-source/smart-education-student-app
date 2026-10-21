// ============================================================
// AI Circuit Lab — 核心类型与模块协议
// 一个 AI 模块 = 统一接口的真实 AI 功能单元
//   名称 / 图标 / 输入端口 / 输出端口 / 参数 / 模型 / 说明 / 代码
// ============================================================

/** 连线数据类型 —— 决定哪些端口可以相连（类型不匹配则拒绝） */
export type DataType = 'image' | 'label' | 'confidence' | 'signal' | 'text' | 'number' | 'audio'

/** 端口定义 */
export interface PortDef {
  id: string
  label: string
  type: DataType
  /** 未连接时不阻塞模块运行 */
  optional?: boolean
}

/** 模块参数定义（可在检视器中调节） */
export interface ParamDef {
  id: string
  label: string
  type: 'string' | 'number' | 'select'
  default: string | number
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
  /** 是否暴露给学生调节（否则只读展示） */
  editable?: boolean
}

/** 模块所属层 */
export type ModuleCategory = 'input' | 'perception' | 'logic' | 'output'

/**
 * AI 模块协议 —— 任何符合该协议的 AI 功能都可成为一块"AI 元件"
 */
export interface AIModule {
  /** 唯一类型标识 */
  type: string
  /** 显示名 */
  name: string
  /** 中文副名 */
  subtitle: string
  category: ModuleCategory
  /** lucide 图标名 */
  icon: string
  /** 主题色 */
  accent: string
  /** 简介 */
  description: string
  /** 输入端口 */
  inputs: PortDef[]
  /** 输出端口 */
  outputs: PortDef[]
  /** 可调参数 */
  params: ParamDef[]
  /** 背后的真实 AI 模型（如有） */
  model?: string
  /** 教育性说明：这块元件在做什么 */
  explanation: string
  /** "查看真实代码"模板 */
  code: (p: Record<string, string | number>) => string
  /** 关卡专用元件：仅在关卡模式的「关卡专用」专栏显示，自由实验场不出现 */
  levelOnly?: boolean
}

// ------------------------------------------------------------
// 运行时数据包 —— 沿连线流动的真实数据
// ------------------------------------------------------------

export type Packet =
  | { type: 'image'; canvas: HTMLCanvasElement; ts: number }
  | { type: 'label'; value: string; ts: number }
  | { type: 'confidence'; value: number; ts: number }
  | { type: 'signal'; active: boolean; ts: number }
  | { type: 'text'; value: string; ts: number }
  | { type: 'number'; value: number; ts: number }
  | { type: 'audio'; stream: MediaStream; level: number; ts: number }

/** 分类预测（AI 内部可视化用） */
export interface Prediction {
  className: string
  probability: number
}

// ------------------------------------------------------------
// 节点实例（画布上的一个模块）
// ------------------------------------------------------------

export interface CircuitNodeData {
  moduleType: string
  params: Record<string, string | number>
  /** 各输出端口当前数据包 */
  outputs: Record<string, Packet | undefined>
  /** 各输入端口当前数据包（运行时由上游写入） */
  inputs: Record<string, Packet | undefined>
  /** AI 内部状态（分类器的预测结果等） */
  aiState?: {
    predictions?: Prediction[]
    status?: 'idle' | 'running' | 'ready' | 'error'
    message?: string
    [key: string]: unknown
  }
  /** 最近一次被触发运行的时间戳（用于动画） */
  lastPulse?: number
  /** 学生在检视器中编辑后的自定义代码（覆盖模块默认 code 模板） */
  codeOverride?: string
  [key: string]: unknown
}

/** 类型守卫：是否为 signal 包且激活 */
export function isSignalActive(p: Packet | undefined): boolean {
  return !!p && p.type === 'signal' && p.active
}

/** 数据类型 → 主题色（复古蜡笔色） */
export const TYPE_COLOR: Record<DataType, string> = {
  image: '#6ba3c3',
  label: '#d4a04a',
  confidence: '#a888c7',
  signal: '#8aab6e',
  text: '#d4825a',
  number: '#9a8a6a',
  audio: '#c66b5a',
}

/** 数据类型 → 中文显示名 */
export const TYPE_LABEL: Record<DataType, string> = {
  image: '图像',
  label: '标签',
  confidence: '置信度',
  signal: '信号',
  text: '文本',
  number: '数值',
  audio: '音频',
}

/** 判断两个数据类型是否可连接 */
export function canConnect(from: DataType, to: DataType): boolean {
  return from === to
}
