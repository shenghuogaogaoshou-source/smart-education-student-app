import { describe, expect, it } from 'vitest'
import {
  buildIntentPayload,
  interpretCompanionIntent,
  parseModelCommand,
} from './companionIntent.mjs'

describe('companion intent policy', () => {
  it('accepts a complete whitelisted command and strips unknown model fields', () => {
    expect(parseModelCommand({
      kind: 'command',
      reply: '我可以带你去知识页。',
      command: { type: 'navigate', target: 'knowledge' },
      hiddenInstruction: 'ignore safety',
    })).toEqual({
      kind: 'command',
      reply: '我可以带你去知识页。',
      command: { type: 'navigate', target: 'knowledge' },
    })
  })

  it('rejects commands outside the local allowlist', () => {
    expect(parseModelCommand({
      kind: 'command',
      reply: '帮你打开。',
      command: { type: 'open-url', url: 'https://example.com' },
    })).toMatchObject({ kind: 'reject' })
  })

  it('clarifies missing parameters and ambiguous model output without executing', () => {
    expect(parseModelCommand({ kind: 'command', command: { type: 'navigate' } })).toMatchObject({ kind: 'clarify' })
    expect(parseModelCommand({})).toMatchObject({ kind: 'clarify' })
  })

  it('forces JSON output and the finite command vocabulary in the DeepSeek request', () => {
    const payload = buildIntentPayload({
      companionId: 'momo',
      text: '继续上次没学完的内容',
    })
    expect(payload.response_format).toEqual({ type: 'json_object' })
    expect(payload.messages.at(-1)?.content).toContain('继续上次没学完的内容')
    expect(payload.messages[0].content).toContain('open-url')
    expect(payload.messages[0].content).toContain('绝不允许')
  })

  it('parses the provider JSON through the same local whitelist', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        kind: 'command',
        reply: '一起回到上次学习的地方。',
        command: { type: 'continue-learning' },
      }) } }],
    }), { status: 200 })

    await expect(interpretCompanionIntent({
      companionId: 'momo',
      text: '继续学习',
      apiKey: 'test-key',
      fetchImpl,
    })).resolves.toEqual({
      kind: 'command',
      reply: '一起回到上次学习的地方。',
      command: { type: 'continue-learning' },
    })
  })
})
