import { requestWithRetry } from '../../app/apiRequest'

type CompanionReplyRequest = {
  companionId: string
  question: string
  signal?: AbortSignal
}
const STUDENT_FACING_ERROR = '伙伴暂时没听清，我们换个简单的问题试试。'
const COMPANION_IDS = new Set(['momo', 'yunduo', 'cloudbloom', 'cloudbelle'])
const MAX_QUESTION_LENGTH = 160

export async function requestCompanionReply({ companionId, question, signal }: CompanionReplyRequest): Promise<string> {
  const normalizedQuestion = question.trim().replace(/\s+/g, ' ').slice(0, MAX_QUESTION_LENGTH)
  if (!normalizedQuestion) throw new Error(STUDENT_FACING_ERROR)
  const normalizedCompanionId = COMPANION_IDS.has(companionId) ? companionId : 'momo'
  const response = await requestWithRetry('/api/companion/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companionId: normalizedCompanionId, question: normalizedQuestion }),
    signal,
  }, {
    attempts: 2,
    timeoutMs: 45_000,
  })

  if (!response.ok) throw new Error(STUDENT_FACING_ERROR)

  const body = await response.json() as { reply?: unknown }
  if (typeof body.reply !== 'string' || !body.reply.trim()) throw new Error(STUDENT_FACING_ERROR)

  return body.reply.trim()
}
