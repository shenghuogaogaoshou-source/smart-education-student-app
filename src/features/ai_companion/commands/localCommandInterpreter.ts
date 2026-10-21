import type { CommandNavigationTarget, InterpretedIntent } from './commandTypes'

const NAVIGATION_RULES: Array<{
  target: CommandNavigationTarget
  words: string[]
  reply: string
}> = [
  { target: 'mall', words: ['积分商城', '商城'], reply: '我们去积分商城看看。' },
  { target: 'knowledge', words: ['知识', '课程'], reply: '我们一起去知识页。' },
  { target: 'test', words: ['测试', '闯关', '挑战'], reply: '我们去继续闯关。' },
  { target: 'profile', words: ['我的', '个人中心'], reply: '我们去“我的”看看。' },
  { target: 'settings', words: ['设置'], reply: '我们去设置页。' },
  { target: 'home', words: ['首页', '主页'], reply: '我们回到首页。' },
]

function normalized(text: string) {
  return text.trim().replace(/\s+/g, '')
}

export function interpretLocalCommand(text: string): InterpretedIntent | null {
  const value = normalized(text)
  if (!value) return null

  if (value.includes('继续') && value.includes('游戏')) {
    return { kind: 'command', reply: '我们接着完成上次的游戏。', command: { type: 'resume-game' } }
  }
  if (value.includes('继续') && (value.includes('学习') || value.includes('上次'))) {
    return { kind: 'command', reply: '我们接着上次的学习进度。', command: { type: 'continue-learning' } }
  }
  if (value.includes('积分') && !value.includes('商城')) {
    return { kind: 'command', reply: '我来帮你查看当前积分。', command: { type: 'show-points' } }
  }
  if (value.includes('勋章') || value.includes('徽章')) {
    return { kind: 'command', reply: '我们去看看已经点亮的勋章。', command: { type: 'show-medals' } }
  }

  const asksToNavigate = /(打开|进入|跳到|回到|返回|去|看看|查看)/.test(value)
  if (!asksToNavigate) return null
  const rule = NAVIGATION_RULES.find((candidate) => candidate.words.some((word) => value.includes(word)))
  return rule
    ? { kind: 'command', reply: rule.reply, command: { type: 'navigate', target: rule.target } }
    : null
}
