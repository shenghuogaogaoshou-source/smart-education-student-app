import { describe, expect, it } from 'vitest'
import { interpretLocalCommand } from './localCommandInterpreter'

describe('local companion command interpreter', () => {
  it.each([
    ['打开知识', { type: 'navigate', target: 'knowledge' }],
    ['带我去测试', { type: 'navigate', target: 'test' }],
    ['打开积分商城', { type: 'navigate', target: 'mall' }],
    ['查看我的积分', { type: 'show-points' }],
    ['继续上次学习', { type: 'continue-learning' }],
    ['继续上次没完成的游戏', { type: 'resume-game' }],
  ] as const)('understands %s without calling a remote model', (text, command) => {
    expect(interpretLocalCommand(text)).toMatchObject({ kind: 'command', command })
  })

  it('leaves an ordinary knowledge question for the configured model', () => {
    expect(interpretLocalCommand('彩虹为什么有颜色？')).toBeNull()
  })
})
