import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestScheduleSuggestion,
  ScheduleSuggestionError,
  type ScheduleSuggestionRequest,
} from './scheduleApi'

const request: ScheduleSuggestionRequest = {
  grade: 'grade5',
  gradeBand: 'grade5-6',
  availability: [{
    date: '2026-10-25',
    enabled: true,
    startTime: '18:30',
    endTime: '19:30',
    maxMinutes: 30,
  }],
  catalog: [{ partId: 'ael-4', kind: 'knowledge', suggestedMinutes: 15 }],
  progress: { knowledgeCompleted: ['ael-1'], testsPassed: [] },
  currentTasks: [],
  wrongQuestionSummaries: [],
}

const responseBody = {
  tasks: [{
    id: 'ai-1',
    grade: 'grade5',
    partId: 'ael-4',
    kind: 'knowledge',
    title: '第一次 AI 实验',
    date: '2026-10-25',
    time: '18:30',
    minutes: 15,
    order: 0,
    source: 'ai',
    review: false,
    createdAt: '2026-10-25T10:00:00.000Z',
    updatedAt: '2026-10-25T10:00:00.000Z',
  }],
  weekSummary: '本周安排了 1 项课程学习。',
  reasons: { 'ai-1': '从真实课程开始探索。' },
}

describe('scheduleApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts only the structured request to the same-origin schedule endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    const result = await requestScheduleSuggestion(request, controller.signal)

    expect(fetchMock).toHaveBeenCalledWith('/api/companion/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/DEEPSEEK|api.?key|sk-/i)
    expect(result.tasks[0]).toMatchObject({ partId: 'ael-4', source: 'ai' })
    expect(result.reasons['ai-1']).toBe('从真实课程开始探索。')
  })

  it('preserves an upstream status without exposing arbitrary response text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'provider_error', detail: 'sensitive upstream body' }),
      { status: 502 },
    )))

    await expect(requestScheduleSuggestion(request)).rejects.toMatchObject({
      name: 'ScheduleSuggestionError',
      status: 502,
      code: 'provider_error',
    })
    await expect(requestScheduleSuggestion(request)).rejects.not.toThrow(/sensitive upstream body/)
  })

  it('rejects malformed successful responses as invalid results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tasks: [{ id: 1 }],
      reasons: [],
    }), { status: 200 })))

    const failure = requestScheduleSuggestion(request)
    await expect(failure).rejects.toBeInstanceOf(ScheduleSuggestionError)
    await expect(failure).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('rejects duplicate or unsafe task ids before they can collide in reasons', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ...responseBody,
      tasks: [responseBody.tasks[0], { ...responseBody.tasks[0] }],
    }), { status: 200 })))

    await expect(requestScheduleSuggestion(request)).rejects.toMatchObject({
      name: 'ScheduleSuggestionError',
      code: 'invalid_response',
    })
  })
})
