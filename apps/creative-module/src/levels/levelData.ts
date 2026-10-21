// ============================================================
// 关卡数据定义
// 当前实现 L1 海洋清道夫，L2-L5 为占位（待开发）
// ============================================================
import type { Level } from './types'

export const LEVELS: Level[] = [
  // ====================== L1 海洋清道夫 ======================
  {
    id: 1,
    name: '海洋清道夫',
    subtitle: 'Ocean Cleaner',
    sceneType: 'ocean',
    difficulty: '入门',
    grade: '1-2年级',
    story:
      '太平洋海域漂浮着塑料瓶、塑料杯等垃圾，同时有大量鱼群活动。' +
      '清理机器人需要 AI 帮助它分辨：是垃圾就抓取，是鱼就放过。' +
      '如果误抓鱼，会伤害海洋生态。',
    sceneDesc:
      '真实海洋照片以传送带方式滚动进入画面。场景相机拍下照片，' +
      'AI 用 COCO-SSD 目标检测模型识别画面中是否有瓶子、杯子等垃圾，' +
      '输出「鱼」或「垃圾」标签，再用 IF 条件判断决定是否让机械臂抓取。',
    availableModules: ['sceneCamera', 'trashClassifier', 'if', 'roboticArm'],
    expectedCircuit: [
      { sourceType: 'sceneCamera', sourcePort: 'image', targetType: 'trashClassifier', targetPort: 'image' },
      { sourceType: 'trashClassifier', sourcePort: 'label', targetType: 'if', targetPort: 'label' },
      { sourceType: 'if', sourcePort: 'signal', targetType: 'roboticArm', targetPort: 'signal' },
    ],
    hints: [
      {
        step: 1,
        text: '点画布左上角的「AI 模块市场」，在「本关」里点「添加」把「场景相机」放进画布——它是机器人的眼睛，会拍摄海面真实照片。',
        expect: 'addModule',
        target: 'sceneCamera',
      },
      {
        step: 2,
        text: '再添加「垃圾分类器」——它用 COCO-SSD 目标检测模型分析画面，检测到瓶子/杯子等垃圾时输出「垃圾」标签，否则输出「鱼」标签。',
        expect: 'addModule',
        target: 'trashClassifier',
      },
      {
        step: 3,
        text: '把场景相机的「图像」端口连到垃圾分类器的「图像」端口。类型必须匹配才能连线。',
        expect: 'connect',
        target: 'image',
      },
      {
        step: 4,
        text: '添加「IF」条件判断节点——它负责把 AI 输出的标签变成行动信号：标签匹配就触发，不匹配就不触发。',
        expect: 'addModule',
        target: 'if',
      },
      {
        step: 5,
        text: '长按 IF 元件（或点画布左上角的滑块按钮）打开检视器，把「当标签包含」设为「垃圾」。这样只有 AI 判定为垃圾时，IF 才会输出真信号。',
        expect: 'setParam',
        target: 'if',
        expectParam: 'targetLabel',
        expectValue: '垃圾',
      },
      {
        step: 6,
        text: '把垃圾分类器的「标签」端口连到 IF 的「标签」端口。AI 的判断结果会送给 IF 做条件匹配。',
        expect: 'connect',
        target: 'label',
      },
      {
        step: 7,
        text: '添加「机械臂」——它听从 IF 的命令：收到真信号就抓取，没信号就放行。',
        expect: 'addModule',
        target: 'roboticArm',
      },
      {
        step: 8,
        text: '把 IF 的「信号」端口连到机械臂的「信号」端口。当 AI 检测到垃圾、IF 匹配成功时，机械臂就会自动抓取。',
        expect: 'connect',
        target: 'signal',
      },
      {
        step: 9,
        text: '点击运行，观察机器人是否正确抓取垃圾、放过鱼。正确率达到 80% 且处理至少 8 张照片即可通关。',
        expect: 'run',
        target: 'roboticArm',
      },
    ],
    concepts: ['目标检测', '标签分类', '条件判断'],
    goal: '正确抓取垃圾，不误抓鱼。正确率达到 80% 且处理至少 8 张照片即可通关。',
    passAccuracy: 0.8,
    passMinHandled: 8,
    guided: true,
  },
  // ====================== L2-L5 占位 ======================
  {
    id: 2,
    name: '森林防火哨兵',
    subtitle: 'Forest Fire Watch',
    sceneType: 'forest',
    difficulty: '简单',
    grade: '1-2年级',
    story: '森林中需要 AI 实时检测火苗并报警，同时区分动物和火源。',
    sceneDesc: '森林俯视图，动物和火苗从右侧出现。',
    availableModules: [],
    expectedCircuit: [],
    hints: [],
    concepts: ['多目标检测', '计数', '并行分支'],
    goal: '检测到火苗立即报警，不误报动物。',
    passAccuracy: 0.8,
    passMinHandled: 8,
    guided: true,
    comingSoon: true,
  },
  {
    id: 3,
    name: '城市无障碍助手',
    subtitle: 'City Accessibility',
    sceneType: 'city',
    difficulty: '中等',
    grade: '3-4年级',
    story: '城市街道需要 AI 识别路牌文字，帮助视障人士出行。',
    sceneDesc: '城市街道场景，路牌和障碍物出现。',
    availableModules: [],
    expectedCircuit: [],
    hints: [],
    concepts: ['文字识别', '大语言模型', '多步链'],
    goal: '识别路牌文字并转换为语音提示。',
    passAccuracy: 0.75,
    passMinHandled: 6,
    guided: true,
    comingSoon: true,
  },
  {
    id: 4,
    name: '智慧交通灯',
    subtitle: 'Smart Traffic Light',
    sceneType: 'crossroad',
    difficulty: '中高',
    grade: '3-4年级',
    story: '十字路口需要 AI 根据车流和行人动态控制交通灯。',
    sceneDesc: '十字路口场景，车辆和行人通行。',
    availableModules: [],
    expectedCircuit: [],
    hints: [],
    concepts: ['多条件逻辑', '阈值', '安全决策'],
    goal: '在保证安全的前提下最大化通行效率。',
    passAccuracy: 0.7,
    passMinHandled: 10,
    guided: false,
    comingSoon: true,
  },
  {
    id: 5,
    name: 'AI 生态城市',
    subtitle: 'AI Eco City',
    sceneType: 'ecocity',
    difficulty: '挑战',
    grade: '5-6年级',
    story: '用全部已学模块，设计一个能自主运转的 AI 城市系统。',
    sceneDesc: '城市全景，多个子系统协同。',
    availableModules: [],
    expectedCircuit: [],
    hints: [],
    concepts: ['系统思维', '多模块 Agent'],
    goal: '自由设计一个能自主应对多种情况的 AI 系统。',
    passAccuracy: 0.7,
    passMinHandled: 15,
    guided: false,
    comingSoon: true,
  },
]

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}
