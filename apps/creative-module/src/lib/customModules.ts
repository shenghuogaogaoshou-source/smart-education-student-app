// ============================================================
// 自定义 AI 模块 —— 用户创建的模块定义、存储、沙箱执行
//
// 设计：
//   - 模块类型用 'custom_xxx' 前缀，避免与内置冲突
//   - 所有自定义模块共享一个 ReactFlow 节点类型 'custom'
//   - 用户代码通过 new Function() 沙箱执行，预检危险 API
//   - localStorage 持久化，刷新不丢失
// ============================================================
import type { AIModule, PortDef, ParamDef, ModuleCategory, Packet, CircuitNodeData } from '../types/circuit'
import { registerDynamicModule, unregisterDynamicModule } from './moduleRegistry'
import { registerDynamicEvaluator, unregisterDynamicEvaluator, type Evaluator, type EvalResult } from './evaluators'

const STORAGE_KEY = 'aicircuit.customModules'

// -------------------- 类型 --------------------

export interface CustomModuleDef {
  /** 唯一标识，同时作为 moduleType，格式 'custom_<id>' */
  type: string
  name: string
  subtitle: string
  category: ModuleCategory
  icon: string
  accent: string
  description: string
  inputs: PortDef[]
  outputs: PortDef[]
  params: ParamDef[]
  /** 用户编写的 JavaScript 函数体 */
  userCode: string
  createdAt: number
}

// -------------------- 存储 --------------------

let customModules: CustomModuleDef[] = loadFromStorage()

function loadFromStorage(): CustomModuleDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 写入 localStorage
 * 失败必须抛出明确错误：以前这里静默忽略，addCustomModule 仍返回成功，
 * 模块"能用"只是内存里的假象，刷新后直接消失。抛错才能让调用方提示用户。
 */
function saveToStorage(list: CustomModuleDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    throw new Error(
      `自定义模块保存失败：本地存储不可用或空间已满（${(e as Error).message}）。请清理浏览器存储后重试。`,
    )
  }
}

/** 获取所有自定义模块 */
export function getCustomModules(): CustomModuleDef[] {
  return customModules
}

/** 根据 type 获取单个自定义模块 */
export function getCustomModule(type: string): CustomModuleDef | undefined {
  return customModules.find((m) => m.type === type)
}

/** 添加自定义模块（内部实现，仅写入存储；通知版见底部导出） */
function addCustomModule(def: Omit<CustomModuleDef, 'type' | 'createdAt'>): CustomModuleDef {
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const full: CustomModuleDef = { ...def, type: id, createdAt: Date.now() }
  const next = [...customModules, full]
  // 先落盘再改内存：写入失败会抛错，注册表保持原样，不会留下"内存里有、磁盘上没有"的半更新
  saveToStorage(next)
  customModules = next
  return full
}

/** 删除自定义模块（内部实现，仅写存储；通知版见底部导出） */
function removeCustomModule(type: string) {
  const next = customModules.filter((m) => m.type !== type)
  saveToStorage(next)
  customModules = next
}

// -------------------- 转换为 AIModule --------------------

/** 将自定义模块定义转换为标准 AIModule 接口 */
export function toAIModule(def: CustomModuleDef): AIModule {
  return {
    type: def.type,
    name: def.name,
    subtitle: def.subtitle,
    category: def.category,
    icon: def.icon,
    accent: def.accent,
    description: def.description,
    inputs: def.inputs,
    outputs: def.outputs,
    params: def.params,
    explanation: `自定义模块：${def.description}`,
    code: () => def.userCode,
  }
}

// -------------------- 安全沙箱 --------------------

/** 危险 API 关键词列表 */
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bwindow\b/,
  /\bdocument\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bglobalThis\b/,
  /\bprocess\b/,
  /\bchild_process\b/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\bnavigator\b/,
  /\blocation\b/,
  /\.send\s*\(/,
  /\bWebSocket\b/,
  /\bindexedDB\b/,
  /\bcaches\b/,
  /\bpostMessage\s*\(/,
  // 逃逸链：用 constructor / __proto__ 或 DOM 引用爬到全局对象
  /\bconstructor\b/,
  /\b__proto__\b/,
  /\bownerDocument\b/,
  /\bdefaultView\b/,
  /\bself\b/,
  /\bparent\b/,
  /\btop\b/,
  /\bframes\b/,
  /\bopener\b/,
  // 其他可发起请求 / 创建执行上下文的 API
  /\bWorker\b/,
  /\bimportScripts\b/,
  /\bEventSource\b/,
  /\bRTCPeerConnection\b/,
  /\bImage\s*\(/,
  /\bAudio\s*\(/,
]

/**
 * 作为生成函数形参"占位"的高风险全局，调用时一律传 undefined
 * 这样用户代码里的 window / document / fetch ... 拿到的是 undefined，
 * 而不是页面上的真实对象（关键词黑名单只能挡住写字面量的写法）。
 */
const SHADOWED_GLOBALS: string[] = [
  'window',
  'document',
  'globalThis',
  'self',
  'parent',
  'top',
  'fetch',
  'Function',
  'localStorage',
  'navigator',
  'location',
]

/** 检查用户代码是否包含危险调用 */
export function validateCode(code: string): { ok: boolean; reason?: string } {
  if (!code.trim()) {
    return { ok: false, reason: '代码不能为空' }
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return { ok: false, reason: `代码包含不安全的调用：${pattern.source}` }
    }
  }
  return { ok: true }
}

/** 生成函数（形参顺序与 SHADOWED_GLOBALS 一致，末尾两个是 inputs / params） */
type SandboxFn = (
  window: undefined,
  document: undefined,
  globalThis: undefined,
  self: undefined,
  parent: undefined,
  top: undefined,
  fetch: undefined,
  Function: undefined,
  localStorage: undefined,
  navigator: undefined,
  location: undefined,
  inputs: Record<string, Packet | undefined>,
  params: Record<string, string | number>,
) => unknown

/**
 * 从用户代码创建安全的求值器函数
 *
 * 用户代码是一个函数体，接收 inputs 和 params，返回 { outputs, message }
 * 签式与内置 Evaluator 完全一致，无需类型断言
 *
 * 安全说明：这里仍然是在页面权限下跑 new Function 的"软沙箱"——
 * 关键词黑名单 + 形参遮蔽高风险全局，只能降低而不能消除风险；
 * 真正的隔离需要 iframe / Worker 沙箱，本轮不做（避免推翻现有设计）。
 */
export function createCustomEvaluator(userCode: string, outputs: PortDef[] = []): Evaluator {
  // 声明的输出端口表：只转发这些端口，且数据包 type 必须与 PortDef.type 一致
  const declaredOutputs = new Map(outputs.map((p) => [p.id, p.type]))

  // 只在注册时编译一次：每次求值都 new Function 等于每帧每节点一次 JS 编译
  let sandbox: SandboxFn | null = null
  let compileError = ''
  try {
    sandbox = new Function(
      ...SHADOWED_GLOBALS,
      'inputs',
      'params',
      `"use strict";\n${userCode}`,
    ) as SandboxFn
  } catch (err) {
    compileError = (err as Error).message
  }

  const evalFn: Evaluator = (
    data: CircuitNodeData,
    inputs: Record<string, Packet | undefined>,
  ): EvalResult | null => {
    // 检查所有输入端口是否有数据
    for (const [, pkt] of Object.entries(inputs)) {
      if (pkt === undefined) return null
    }

    if (!sandbox) {
      return {
        outputs: {},
        aiState: { status: 'error', message: `代码编译失败：${compileError}` },
      }
    }

    try {
      // 沙箱函数：仅暴露 inputs 和 params，其余高风险全局传 undefined
      const result = sandbox(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        inputs,
        data.params,
      )

      if (!result || typeof result !== 'object') {
        return {
          outputs: {},
          aiState: { status: 'error', message: '代码未返回有效对象' },
        }
      }

      const returned = result as { outputs?: unknown; message?: unknown }
      const packets: Record<string, Packet> = {}
      const rejected: string[] = []
      const ts = Date.now()

      // 校验并转换为 Packet：只放行声明的端口 + 类型匹配的数据包，其余记入消息
      if (returned.outputs && typeof returned.outputs === 'object') {
        for (const [portId, val] of Object.entries(
          returned.outputs as Record<string, unknown>,
        )) {
          const declaredType = declaredOutputs.get(portId)
          if (!declaredType) {
            rejected.push(`${portId}（未声明的端口）`)
            continue
          }
          if (!val || typeof val !== 'object' || !('type' in val)) {
            rejected.push(`${portId}（缺少 type 字段）`)
            continue
          }
          const packet = val as Packet
          if (packet.type !== declaredType) {
            rejected.push(`${portId}（type=${String(packet.type)} ≠ 声明 ${declaredType}）`)
            continue
          }
          packets[portId] = { ...packet, ts }
        }
      }

      const baseMessage =
        typeof returned.message === 'string' ? returned.message : '执行完成'
      const message =
        rejected.length > 0
          ? `${baseMessage}；已忽略不符合输出端口的项：${rejected.join('、')}`
          : baseMessage
      return {
        outputs: packets,
        aiState: { status: 'ready', message },
      }
    } catch (err) {
      return {
        outputs: {},
        aiState: {
          status: 'error',
          message: `运行时错误：${(err as Error).message}`,
        },
      }
    }
  }
  return evalFn
}

// -------------------- 注册到 moduleRegistry + evaluators --------------------

/** 将自定义模块注册到运行时（moduleRegistry + evaluators） */
function registerToRuntime(def: CustomModuleDef) {
  registerDynamicModule(toAIModule(def))
  // 传入声明的输出端口，用于校验用户代码返回的数据包
  const evaluator = createCustomEvaluator(def.userCode, def.outputs)
  registerDynamicEvaluator(def.type, evaluator)
}

/** 从运行时注销 */
function unregisterFromRuntime(type: string) {
  unregisterDynamicModule(type)
  unregisterDynamicEvaluator(type)
}

/** 应用启动时加载所有已保存的自定义模块到运行时 */
export function initCustomModules() {
  for (const def of customModules) {
    registerToRuntime(def)
  }
}

// -------------------- 默认代码模板 --------------------

export const DEFAULT_USER_CODE = `// 可用变量：
//   inputs - 输入端口数据，如 inputs.label.value
//   params - 模块参数，如 params.threshold
// 返回值：
//   { outputs: { 端口ID: { type: '类型', value/active: 值 } }, message: '状态消息' }

// 示例：标签匹配
const label = inputs.label?.value ?? ''
const target = params.targetLabel ?? ''
const match = label.includes(target)

return {
  outputs: {
    signal: { type: 'signal', active: match }
  },
  message: match ? '匹配成功' : '不匹配'
}`

// -------------------- 订阅机制（简单的发布订阅）--------------------

type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeCustomModules(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  listeners.forEach((fn) => fn())
}

// 重写 addCustomModule 和 removeCustomModule 以触发注册 + 通知
const _addCustomModule = addCustomModule
const _removeCustomModule = removeCustomModule

function addCustomModuleNotify(def: Omit<CustomModuleDef, 'type' | 'createdAt'>): CustomModuleDef {
  const result = _addCustomModule(def)
  registerToRuntime(result)
  notify()
  return result
}

function removeCustomModuleNotify(type: string) {
  _removeCustomModule(type)
  unregisterFromRuntime(type)
  notify()
}

export { addCustomModuleNotify as addCustomModule, removeCustomModuleNotify as removeCustomModule }
