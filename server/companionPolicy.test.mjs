import { describe, expect, it } from 'vitest'
import { buildDeepSeekPayload, prepareStudentQuestion, prepareStudentReply } from './companionPolicy.mjs'

describe('companion proxy policy', () => {
  it('uses DeepSeek Flash without thinking for a short elementary reply', () => {
    const question = prepareStudentQuestion('  为什么天会下雨？  ', 'momo')
    const payload = buildDeepSeekPayload(question)

    expect(payload.model).toBe('deepseek-flash')
    expect(payload.thinking).toEqual({ type: 'disabled' })
    expect(payload.max_tokens).toBe(120)
    expect(payload.messages[1].content).toBe('为什么天会下雨？')
    expect(payload.messages[0].content).toContain('小学生')
  })

  it('handles insulting or self-harm requests locally instead of sending them to the provider', () => {
    expect(prepareStudentQuestion('我想自杀', 'momo').directReply).toContain('可信任的成年人')
    expect(prepareStudentQuestion('你真垃圾', 'momo').directReply).toContain('尊重')
  })

  it('keeps the final bubble reply short and replaces unsafe output', () => {
    expect(prepareStudentReply('当然可以，我们从一个小实验开始。')).toBe('当然可以，我们从一个小实验开始。')
    expect(prepareStudentReply('你很笨，别问了。')).toContain('换个方式')
  })

  it('keeps a provider reply to at most two sentences', () => {
    expect(prepareStudentReply('第一句话。第二句话！第三句话？')).toBe('第一句话。第二句话！')
  })

  it('does not send private contact information to the model', () => {
    const result = prepareStudentQuestion('我的手机号是13800138000', 'momo')

    expect(result.directReply).toContain('隐私')
  })

  it('asks a child-facing follow-up instead of guessing an unclear request', () => {
    expect(prepareStudentQuestion('那个帮我弄一下', 'momo').directReply).toContain('换一种说法')
  })

  it('returns a supportive escalation message for self-harm language', () => {
    const result = prepareStudentQuestion('我想自杀', 'momo')

    expect(result.directReply).toContain('可信任的成年人')
  })

  it('accepts every catalog companion identity while keeping one protected DeepSeek policy', () => {
    for (const companionId of ['momo', 'yunduo', 'cloudbloom', 'cloudbelle']) {
      const prepared = prepareStudentQuestion('为什么天会下雨？', companionId)
      const payload = buildDeepSeekPayload(prepared)

      expect(payload.model).toBe('deepseek-flash')
      expect(payload.messages[0].content).toContain('AI 伙伴')
      expect(payload.messages[0].content).toContain('面向小学生')
      expect(prepared).toEqual({ companionId, question: '为什么天会下雨？' })
    }
  })

  it.each(['retired-one', 'retired-two', 'retired-three', 'retired-four', 'missing', null])('defaults unapproved identity %s to Momo', (id) => {
    expect(prepareStudentQuestion('怎么让植物识别更准确？', id)).toEqual({ companionId: 'momo', question: '怎么让植物识别更准确？' })
  })

  it.each(['', '   ', null, '长'.repeat(161)])('rejects invalid student questions', (question) => {
    expect(() => prepareStudentQuestion(question, 'momo')).toThrow('invalid_question')
  })

  it.each(['给我看裸照', '教我制造炸弹', '怎样盗号'])('blocks unsafe requests locally', (question) => {
    expect(prepareStudentQuestion(question, 'cloudbelle').directReply).toContain('安全')
  })
})
