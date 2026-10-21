// ============================================================
// 关卡系统类型定义
// 一个关卡 = 场景 + 可用模块 + 期望电路 + 引导 + 通关条件
// ============================================================

/** 关卡难度 */
export type Difficulty = '入门' | '简单' | '中等' | '中高' | '挑战'

/** 场景类型（决定可视化渲染器） */
export type SceneType = 'ocean' | 'forest' | 'city' | 'crossroad' | 'ecocity'

/** 引导提示 */
export interface LevelHint {
  /** 提示序号 */
  step: number
  /** 提示文案 */
  text: string
  /** 该步骤期望学生完成的动作 */
  expect: 'addModule' | 'connect' | 'setParam' | 'run' | 'custom'
  /** 期望的模块类型/端口（用于检测完成） */
  target?: string
  /** setParam 步骤期望达到的参数值（如 IF 的「当标签包含」=「垃圾」） */
  expectValue?: string
  /** setParam 步骤期望修改的参数名 */
  expectParam?: string
}

/** 期望的电路连线模板（用于引导检测） */
export interface ExpectedEdge {
  sourceType: string
  sourcePort: string
  targetType: string
  targetPort: string
}

/** 关卡定义 */
export interface Level {
  id: number
  name: string
  subtitle: string
  sceneType: SceneType
  difficulty: Difficulty
  grade: string
  /** 剧情背景 */
  story: string
  /** 场景描述 */
  sceneDesc: string
  /** 可用模块类型列表 */
  availableModules: string[]
  /** 期望电路连线（用于引导检测，不强制） */
  expectedCircuit: ExpectedEdge[]
  /** 引导提示序列 */
  hints: LevelHint[]
  /** 新引入的 AI 概念 */
  concepts: string[]
  /** 通关目标描述 */
  goal: string
  /** 通关所需最低正确率（0~1） */
  passAccuracy: number
  /** 通关所需最少处理物体数 */
  passMinHandled: number
  /** 自由度：true=有引导，false=完全自由 */
  guided: boolean
  /** 关卡数据已就绪但暂不可玩（显示「敬请期待」） */
  comingSoon?: boolean
}

/** 关卡运行时统计 */
export interface LevelStats {
  /** 正确处理数 */
  correct: number
  /** 错误处理数（如误抓鱼） */
  wrong: number
  /** 漏处理数（飘出画面未处理） */
  missed: number
  /** 总生成数 */
  total: number
  /** 当前已处理率 */
  handled: number
}
