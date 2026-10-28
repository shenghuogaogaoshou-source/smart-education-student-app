import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stories } from './content/storyContent'
import type { DayStory } from './content/storyContent'
import { buildStorySegments, useReadAloud } from './useReadAloud'

// 一集最小的故事：目标 + 三页画面（含一页既无旁白也无对话）+ 小课堂 + 挑战
const sampleStory: DayStory = {
  day: 1,
  title: '启明星岛 · 认识AI',
  island: '启明星岛',
  gem: '好奇宝石',
  goal: '认识 AI 是会看、会听、会帮忙的聪明工具。',
  panels: [
    { scene: '星空', narration: '启明星变暗了。', dialog: [] },
    {
      scene: '飞船内',
      dialog: [
        { speaker: '小多', line: '集合啦！' },
        { speaker: '小贝', line: '我们能帮忙吗？' },
      ],
    },
    { scene: '空镜', dialog: [] },
  ],
  miniLesson: { speaker: '博士星', text: 'AI 是聪明工具。' },
  challenge: { question: 'AI 会做什么？', answer: '会看、会听、会帮忙。' },
}

// 稳定的分段引用：useReadAloud 的「切换故事即停止播报」effect 依赖 segments 的引用相等，
// 测试里若每次 render 都重新构建数组，任何状态更新都会触发清理并中断播报。
const sampleSegments = buildStorySegments(sampleStory)

type SpeechStub = {
  getVoices: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  speak: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  onvoiceschanged: null
}

let speech: SpeechStub

function installSpeechStub() {
  speech = {
    getVoices: vi.fn(() => []),
    cancel: vi.fn(),
    speak: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onvoiceschanged: null,
  }
  Object.defineProperty(window, 'speechSynthesis', { value: speech, configurable: true })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: class {
      text: string
      lang = ''
      rate = 1
      voice: unknown = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) {
        this.text = text
      }
    },
    configurable: true,
  })
}

// 语音桩必须贯穿整文件的生命周期：测试结束后 React 卸载 hook 时仍会调用
// window.speechSynthesis.cancel()，此时删除桩会让清理阶段抛错并污染断言。
function resetSpeechStub() {
  speech.cancel.mockClear()
  speech.speak.mockClear()
  speech.pause.mockClear()
  speech.resume.mockClear()
  speech.getVoices.mockClear()
}

function audioMock() {
  const blob = new Blob([new Uint8Array([0xff, 0xf3, 0x64])], { type: 'audio/mpeg' })
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
    { ok: true, blob: async () => blob } as unknown as Response
  ))
}

describe('buildStorySegments', () => {
  it('reads the goal, every panel line, the lesson and the challenge in order', () => {
    expect(sampleSegments.map((segment) => segment.text)).toEqual([
      '今天的目标：认识 AI 是会看、会听、会帮忙的聪明工具。',
      '启明星变暗了。',
      '小多说：集合啦！',
      '小贝说：我们能帮忙吗？',
      '第3页',
      '博士星小课堂。AI 是聪明工具。',
      '闯关小挑战。AI 会做什么？',
      '小提示。会看、会听、会帮忙。',
    ])
  })

  it('anchors panel lines to their page and section lines to their block', () => {
    expect(sampleSegments[0]).toMatchObject({ anchor: 'story-goal', panelIndex: null })
    expect(sampleSegments[2]).toMatchObject({ anchor: 'story-panel-1', panelIndex: 1 })
    expect(sampleSegments[3]).toMatchObject({ anchor: 'story-panel-1', panelIndex: 1 })
    expect(sampleSegments[5]).toMatchObject({ anchor: 'story-lesson', panelIndex: null })
    expect(sampleSegments[7]).toMatchObject({ anchor: 'story-challenge', panelIndex: null })
  })

  it('builds a non-empty segment list for every shipped comic day', () => {
    for (const story of stories) {
      const segments = buildStorySegments(story)
      expect(segments.length).toBeGreaterThan(story.panels.length)
      expect(segments.every((segment) => segment.text.trim().length > 0)).toBe(true)
      expect(segments[0].text.startsWith('今天的目标：')).toBe(true)
    }
  })
})

describe('useReadAloud', () => {
  beforeAll(() => installSpeechStub())

  beforeEach(() => {
    resetSpeechStub()
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock-audio'),
      revokeObjectURL: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports whether the browser can read aloud at all', () => {
    const { result } = renderHook(() => useReadAloud(sampleSegments))
    expect(result.current.supported).toBe(true)
    expect(result.current.status).toBe('idle')
  })

  it('plays through the server voice and shows the sentence being read', async () => {
    const fetchSpy = audioMock()
    vi.stubGlobal('fetch', fetchSpy)
    const { result } = renderHook(() => useReadAloud(sampleSegments))

    act(() => result.current.play())

    await waitFor(() => expect(result.current.engine).toBe('server'))
    expect(result.current.status).toBe('playing')
    expect(result.current.index).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))
    expect(body.text).toBe('今天的目标：认识 AI 是会看、会听、会帮忙的聪明工具。')
  })

  it('falls back to the local browser voice when the server cannot synthesize', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response))
    const { result } = renderHook(() => useReadAloud(sampleSegments))

    act(() => result.current.play())

    await waitFor(() => expect(result.current.engine).toBe('local'))
    // 本地播报在 cancel 之后延迟 80ms 才 speak，用来绕开 Chrome 偶发不发声
    await waitFor(() => expect(speech.speak).toHaveBeenCalledTimes(1), { timeout: 1000 })
    expect(speech.cancel).toHaveBeenCalled()
    expect(result.current.status).toBe('playing')
  })

  it('pauses the running sentence instead of restarting it', async () => {
    const fetchSpy = audioMock()
    vi.stubGlobal('fetch', fetchSpy)
    const { result } = renderHook(() => useReadAloud(sampleSegments))
    act(() => result.current.play())
    // 等首句真正开始播放（服务端音频已加载）再模拟点击「暂停播读」
    await waitFor(() => expect(result.current.engine).toBe('server'))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())

    act(() => result.current.pause())

    expect(result.current.status).toBe('paused')
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(result.current.index).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('resumes the paused sentence without asking the server again', async () => {
    const fetchSpy = audioMock()
    vi.stubGlobal('fetch', fetchSpy)
    const { result } = renderHook(() => useReadAloud(sampleSegments))
    act(() => result.current.play())
    await waitFor(() => expect(result.current.engine).toBe('server'))
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled())
    act(() => result.current.pause())
    expect(result.current.status).toBe('paused')

    await act(async () => { result.current.play() })

    await waitFor(() => expect(result.current.status).toBe('playing'))
    expect(result.current.index).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  })

  it('stops reading and resets to the idle sentence count', async () => {
    vi.stubGlobal('fetch', audioMock())
    const { result } = renderHook(() => useReadAloud(sampleSegments))
    act(() => result.current.play())
    await waitFor(() => expect(result.current.engine).toBe('server'))

    act(() => result.current.stop())

    expect(result.current.status).toBe('idle')
    expect(result.current.index).toBe(-1)
    expect(speech.cancel).toHaveBeenCalled()
  })

  it('moves to the next and previous sentence', async () => {
    vi.stubGlobal('fetch', audioMock())
    const { result } = renderHook(() => useReadAloud(sampleSegments))
    act(() => result.current.play())
    await waitFor(() => expect(result.current.engine).toBe('server'))

    act(() => result.current.next())
    await waitFor(() => expect(result.current.index).toBe(1))

    act(() => result.current.prev())
    await waitFor(() => expect(result.current.index).toBe(0))
  })

  it('uses cloud-backed reading on native even without browser speech synthesis', async () => {
    const browserSpeech = window.speechSynthesis
    let finishCurrent: (() => void) | null = null
    const cancel = vi.fn()
    const playText = vi.fn((_text: string, _enabled: boolean, onEnd?: () => void) => {
      finishCurrent = onEnd ?? null
      return { cancel }
    })

    try {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined })
      Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        value: { isNativePlatform: () => true },
      })
      const { result, unmount } = renderHook(() => useReadAloud(sampleSegments, { playText }))

      expect(result.current.supported).toBe(true)
      act(() => result.current.play(0))
      expect(playText).toHaveBeenCalledWith(
        '今天的目标：认识 AI 是会看、会听、会帮忙的聪明工具。',
        true,
        expect.any(Function),
      )
      act(() => finishCurrent?.())
      expect(result.current.index).toBe(1)

      unmount()
      expect(cancel).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: browserSpeech })
      delete (window as Window & { Capacitor?: unknown }).Capacitor
    }
  })

  it('stops active reading when the app moves to the background', async () => {
    vi.stubGlobal('fetch', audioMock())
    const { result } = renderHook(() => useReadAloud(sampleSegments))
    act(() => result.current.play())
    await waitFor(() => expect(result.current.engine).toBe('server'))
    expect(result.current.status).toBe('playing')

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(result.current.status).toBe('idle')
    expect(result.current.index).toBe(-1)
  })
})
