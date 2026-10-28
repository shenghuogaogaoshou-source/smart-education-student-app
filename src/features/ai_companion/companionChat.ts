import { requestWithRetry } from '../../app/apiRequest'

type CompanionReplyRequest = {
  companionId: string
  question: string
  signal?: AbortSignal
  onDelta?: (reply: string) => void
}
const STUDENT_FACING_ERROR = '伙伴暂时没听清，我们换个简单的问题试试。'
const COMPANION_IDS = new Set(['momo', 'yunduo', 'cloudbloom', 'cloudbelle'])
const MAX_QUESTION_LENGTH = 160

function parseSseBlock(block: string) {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return null
  const raw = data.join('\n')
  try {
    return { event, data: JSON.parse(raw) as Record<string, unknown> }
  } catch {
    return null
  }
}

async function readReplyStream(response: Response, onDelta?: (reply: string) => void) {
  if (!response.body) throw new Error(STUDENT_FACING_ERROR)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let accumulated = ''
  let completed = ''

  while (true) {
    const { done, value } = await reader.read()
    pending += decoder.decode(value, { stream: !done })
    const blocks = pending.split(/\r?\n\r?\n/)
    pending = blocks.pop() ?? ''
    for (const block of blocks) {
      const parsed = parseSseBlock(block)
      if (!parsed) continue
      if (parsed.event === 'delta' && typeof parsed.data.text === 'string') {
        accumulated += parsed.data.text
        onDelta?.(accumulated)
      } else if (parsed.event === 'done' && typeof parsed.data.reply === 'string') {
        completed = parsed.data.reply.trim()
      } else if (parsed.event === 'error') {
        throw new Error(STUDENT_FACING_ERROR)
      }
    }
    if (done) break
  }

  if (pending.trim()) {
    const parsed = parseSseBlock(pending)
    if (parsed?.event === 'done' && typeof parsed.data.reply === 'string') completed = parsed.data.reply.trim()
  }
  const reply = completed || accumulated.trim()
  if (!reply) throw new Error(STUDENT_FACING_ERROR)
  return reply
}

export async function requestCompanionReply({ companionId, question, signal, onDelta }: CompanionReplyRequest): Promise<string> {
  const normalizedQuestion = question.trim().replace(/\s+/g, ' ').slice(0, MAX_QUESTION_LENGTH)
  if (!normalizedQuestion) throw new Error(STUDENT_FACING_ERROR)
  const normalizedCompanionId = COMPANION_IDS.has(companionId) ? companionId : 'momo'
  const response = await requestWithRetry('/api/companion/reply/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companionId: normalizedCompanionId, question: normalizedQuestion }),
    signal,
  }, {
    attempts: 2,
    timeoutMs: 45_000,
  })

  if (!response.ok) throw new Error(STUDENT_FACING_ERROR)

  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    return readReplyStream(response, onDelta)
  }

  const body = await response.json() as { reply?: unknown }
  if (typeof body.reply !== 'string' || !body.reply.trim()) throw new Error(STUDENT_FACING_ERROR)
  const reply = body.reply.trim()
  onDelta?.(reply)
  return reply
}
