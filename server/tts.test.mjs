import { beforeEach, describe, expect, it, vi } from 'vitest'

// 用假的 Edge TTS 客户端替代真实 WebSocket，只验证输入校验、音色白名单与串行化。
const synthesizeCalls = []
const metadataCalls = []

vi.mock('msedge-tts', () => {
  class MsEdgeTTS {
    async setMetadata(voice) {
      metadataCalls.push(voice)
    }

    toStream(text, options) {
      synthesizeCalls.push({ text, rate: options?.rate })
      const listeners = {}
      const stream = {
        on(event, handler) {
          listeners[event] = handler
          return stream
        },
      }
      // 模拟一次异步音频流：先出数据，再结束
      setTimeout(() => {
        listeners.data?.(Buffer.from([0xff, 0xf3, 0x64]))
        listeners.end?.()
      }, 0)
      return { audioStream: stream }
    }
  }
  return {
    MsEdgeTTS,
    OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3' },
  }
})

// tts.mjs 用模块级单例缓存连接与当前音色，每个用例都要重新加载模块，
// 否则上一个用例协商过的音色会让 setMetadata 断言落空。
let synthesizeSpeech

beforeEach(async () => {
  synthesizeCalls.length = 0
  metadataCalls.length = 0
  vi.resetModules()
  ;({ synthesizeSpeech } = await import('./tts.mjs'))
})

describe('tts proxy', () => {
  it('rejects empty input', async () => {
    await expect(synthesizeSpeech('   ', undefined)).rejects.toThrow('invalid_input')
    await expect(synthesizeSpeech(undefined, undefined)).rejects.toThrow('invalid_input')
  })

  it('rejects text longer than the two thousand character limit', async () => {
    await expect(synthesizeSpeech('a'.repeat(2001), undefined)).rejects.toThrow('text_too_long')
  })

  it('speaks the approved voice with the slower reading rate', async () => {
    const audio = await synthesizeSpeech('  启明星变暗了。  ', 'zh-CN-YunxiNeural')

    expect(audio.length).toBeGreaterThan(0)
    expect(metadataCalls).toEqual(['zh-CN-YunxiNeural'])
    expect(synthesizeCalls).toEqual([{ text: '启明星变暗了。', rate: '-10%' }])
  })

  it('falls back to the default voice when the request names an unapproved one', async () => {
    await synthesizeSpeech('你好', 'zh-CN-NotAllowedNeural')

    expect(metadataCalls).toEqual(['zh-CN-XiaoxiaoNeural'])
  })

  it('serializes concurrent requests and negotiates the voice only once', async () => {
    await Promise.all([
      synthesizeSpeech('第一句', undefined),
      synthesizeSpeech('第二句', undefined),
      synthesizeSpeech('第三句', undefined),
    ])

    expect(synthesizeCalls.map((call) => call.text)).toEqual(['第一句', '第二句', '第三句'])
    expect(metadataCalls).toEqual(['zh-CN-XiaoxiaoNeural'])
  })
})
