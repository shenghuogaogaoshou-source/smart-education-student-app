import { describe, expect, it, vi } from 'vitest'
import { transcribeAudio } from './transcription.mjs'

describe('companion audio transcription', () => {
  it('transcribes a data URL with the configured Qwen ASR model', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '天空为什么是蓝色的？' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await expect(transcribeAudio({
      audio: 'data:audio/webm;base64,YQ==',
    }, {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.example/compatible-mode/v1',
      fetchImpl,
    })).resolves.toEqual({ text: '天空为什么是蓝色的？' })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://dashscope.example/compatible-mode/v1/chat/completions')
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'qwen3-asr-flash',
      messages: [{
        role: 'user',
        content: [{
          type: 'input_audio',
          input_audio: { data: 'data:audio/webm;base64,YQ==' },
        }],
      }],
      asr_options: { language: 'zh', enable_itn: true },
    })
    expect(init.headers.authorization).toBe('Bearer dashscope-key')
  })

  it('rejects missing or unsupported audio input', async () => {
    await expect(transcribeAudio({}, { apiKey: 'key' })).rejects.toThrow('invalid_input')
    await expect(transcribeAudio({
      audio: 'data:text/plain;base64,YQ==',
    }, { apiKey: 'key' })).rejects.toThrow('invalid_input')
  })
})
