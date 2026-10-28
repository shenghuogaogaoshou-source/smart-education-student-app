const AUDIO_DATA_URL = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/i
const MAX_AUDIO_DATA_URL_LENGTH = 10 * 1024 * 1024

export function validateTranscriptionInput(body) {
  const audio = typeof body?.audio === 'string' ? body.audio.trim() : ''
  if (!AUDIO_DATA_URL.test(audio) || audio.length > MAX_AUDIO_DATA_URL_LENGTH) {
    throw new Error('invalid_input')
  }
  return audio
}

export async function transcribeAudio(body, {
  apiKey,
  baseUrl = process.env.ASR_BASE_URL || process.env.VISION_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model = process.env.ASR_MODEL || 'qwen3-asr-flash',
  fetchImpl = fetch,
} = {}) {
  const audio = validateTranscriptionInput(body)
  if (!apiKey) throw new Error('asr_not_configured')

  const upstream = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [{
          type: 'input_audio',
          input_audio: { data: audio },
        }],
      }],
      stream: false,
      asr_options: {
        language: 'zh',
        enable_itn: true,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!upstream.ok) throw new Error('provider_error')
  const data = await upstream.json()
  const content = data?.choices?.[0]?.message?.content
  const text = typeof content === 'string'
    ? content.trim()
    : Array.isArray(content)
      ? content.map((item) => item?.text || '').join('').trim()
      : ''
  if (!text || text.length > 4000) throw new Error('invalid_result')
  return { text }
}
