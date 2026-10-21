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

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customModules))
  } catch {
    // 忽略写入失败
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
  customModules = [...customModules, full]
  saveToStorage()
  return full
}

/** 删除自定义模块（内部实现，仅写存储；通知版见底部导出） */
function removeCustomModule(type: string) {
  customModules = customModules.filter((m) => m.type !== type)
  saveToStorage()
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

/**
 * 从用户代码创建安全的求值器函数
 *
 * 用户代码是一个函数体，接收 inputs 和 params，返回 { outputs, message }
 * 签式与内置 Evaluator 完全一致，无需类型断言
 */
export function createCustomEvaluator(userCode: string): Evaluator {
  const evalFn: Evaluator = (
    data: CircuitNodeData,
    inputs: Record<string, Packet | undefined>,
  ): EvalResult | null => {
    // 检查所有输入端口是否有数据
    for (const [, pkt] of Object.entries(inputs)) {
      if (pkt === undefined) return null
    }

    try {
      // 创建沙箱函数：仅暴露 inputs 和 params
      const fn = new Function('inputs', 'params', `"use strict";\n${userCode}`)
      const result = fn(inputs, data.params)

      if (!result || typeof result !== 'object') {
        return {
          outputs: {},
          aiState: { status: 'error', message: '代码未返回有效对象' },
        }
      }

      const outputs: Record<string, Packet> = {}
      const ts = Date.now()

      // 将用户返回的输出转换为 Packet 格式
      if (result.outputs && typeof result.outputs === 'object') {
        for (const [portId, val] of Object.entries(result.outputs)) {
          if (val && typeof val === 'object' && 'type' in val) {
            outputs[portId] = { ...(val as Packet), ts }
          }
        }
      }

      const message = typeof result.message === 'string' ? result.message : '执行完成'
      return {
        outputs,
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
  const evaluator = createCustomEvaluator(def.userCode)
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
