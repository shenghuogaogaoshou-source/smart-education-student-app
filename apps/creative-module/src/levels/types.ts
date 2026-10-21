// ============================================================
// 关卡系统类型定义
// 一个关卡 = 场景 + 可用模块 + 期望电路 + 引导 + 通关条件
// ============================================================

/** 关卡难度 */
export type Difficulty = '入门' | '简单' | '中等' | '中高' | '挑战'

/** 场景类型（决定可视化渲染器） */
export type SceneType = 'ocean' | 'forest' | 'city' | 'crossroad' | 'ecocity'

/** 场景中漂浮的物体（鱼/垃圾/火苗/行人…） */
export interface SceneObject {
  id: number
  /** 物体类别标签（分类器应输出的标签） */
  kind: string
  /** 显示名 */
  label: string
  /** 当前 x 坐标（0~1，相对场景宽度） */
  x: number
  /** 当前 y 坐标（0~1，相对场景高度） */
  y: number
  /** 水平速度（每秒移动占比） */
  vx: number
  /** 外观样式 key（用于绘制不同外观） */
  appearance: string
  /** 是否已被处理（抓取/放行） */
  resolved?: boolean
  /** 处理结果：correct=正确处理, wrong=错误处理, miss=漏处理 */
  result?: 'correct' | 'wrong' | 'miss'
}

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

/** 关卡运行状态 */
export interface LevelRunState {
  status: 'idle' | 'running' | 'paused' | 'passed' | 'failed'
  stats: LevelStats
  /** 当前引导步骤索引 */
  hintStep: number
  /** 已完成的引导步骤 */
  completedSteps: number[]
}
