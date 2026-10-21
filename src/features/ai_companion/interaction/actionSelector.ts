import type { CompanionMotion } from '../render2d/types'

export type CompanionActionScene = 'login' | 'home' | 'knowledge' | 'test-map' | 'mall'

export type CompanionReaction = {
  reactionId: string
  message: string
  motion: CompanionMotion
}

type ActionSelection = {
  scene: CompanionActionScene
  recentActions: string[]
  progress: number
}

const ACTION_POOLS: Record<CompanionActionScene, CompanionReaction[]> = {
  login: [
    { reactionId: 'login-wave', message: '嗨！我已经准备好陪你出发啦。', motion: 'wave' },
    { reactionId: 'login-peek', message: '今天会长出什么新本领呢？', motion: 'tilt' },
    { reactionId: 'login-nod', message: '轻轻点我，我会一直在这里陪你。', motion: 'blink' },
  ],
  home: [
    { reactionId: 'home-continue', message: '要不要继续上次的小冒险？', motion: 'wave' },
    { reactionId: 'home-create', message: '创意游戏里又有新点子等你啦！', motion: 'tilt' },
    { reactionId: 'home-progress', message: '今天也向前走一小步吧。', motion: 'blink' },
  ],
  knowledge: [
    { reactionId: 'knowledge-curious', message: '把这个知识点弄明白，就又多一项本领啦。', motion: 'tilt' },
    { reactionId: 'knowledge-step', message: '不用着急，我们把知识一小块一小块看懂。', motion: 'blink' },
    { reactionId: 'knowledge-question', message: '遇到不懂的知识，可以长按问我。', motion: 'wave' },
  ],
  'test-map': [
    { reactionId: 'test-next', message: '下一关就在这里，我陪你一起试试！', motion: 'wave' },
    { reactionId: 'test-courage', message: '先想一想再闯关，你一定能发现线索。', motion: 'tilt' },
    { reactionId: 'test-celebrate', message: '这一关完成得很认真，为你庆祝一下！', motion: 'celebrate' },
  ],
  mall: [
    { reactionId: 'mall-turn', message: '左右转身看看，背后的搭配也很重要哦。', motion: 'wave' },
    { reactionId: 'mall-try', message: '可以先试穿，喜欢再用积分带走。', motion: 'tilt' },
    { reactionId: 'mall-own', message: '买过的装扮都收在“我的”里面。', motion: 'blink' },
  ],
}

export function selectCompanionAction({ scene, recentActions, progress }: ActionSelection): CompanionReaction {
  const pool = ACTION_POOLS[scene]
  if (scene === 'test-map' && progress >= 100) return pool[2]
  const previous = recentActions.at(-1)
  return pool.find((reaction) => reaction.reactionId !== previous) ?? pool[0]
}

export function canTriggerCompanionAction(lastTriggeredAt: number | null, now: number, minimumIntervalMs = 4_000) {
  return lastTriggeredAt === null || now - lastTriggeredAt >= minimumIntervalMs
}
