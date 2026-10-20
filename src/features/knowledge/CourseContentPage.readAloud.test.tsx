import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { stories } from './content/storyContent'
import { buildStorySegments } from './useReadAloud'
import { CourseContentPage } from './CourseContentPage'

const dayOne = stories[0]
const segmentCount = buildStorySegments(dayOne).length

let speech: {
  getVoices: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  speak: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  onvoiceschanged: null
}

// 语音桩要贯穿整文件生命周期：卸载绘本页面时组件仍会调用 speechSynthesis.cancel()
beforeAll(() => {
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
})

function renderComic() {
  return render(
    <AppStateProvider>
      <CourseContentPage courseId="qmx" chapterNum={1} onBack={() => undefined} />
    </AppStateProvider>,
  )
}

function ttsMock() {
  const blob = new Blob([new Uint8Array([0xff, 0xf3, 0x64])], { type: 'audio/mpeg' })
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
    { ok: true, blob: async () => blob } as unknown as Response
  ))
}

describe('CourseContentPage read-aloud player', () => {
  let fetchSpy: ReturnType<typeof ttsMock>

  beforeEach(() => {
    speech.cancel.mockClear()
    speech.speak.mockClear()
    fetchSpy = ttsMock()
    vi.stubGlobal('fetch', fetchSpy)
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

  it('shows a read-aloud player above the comic with the total sentence count', () => {
    renderComic()

    const player = screen.getByRole('group', { name: '绘本播读控制' })
    expect(within(player).getByRole('button', { name: '开始播读' })).toBeInTheDocument()
    expect(within(player).getByText(`${segmentCount} 句`)).toBeInTheDocument()
    expect(within(player).getByText('跟我读')).toBeInTheDocument()
  })

  it('starts reading the first sentence from the server voice', async () => {
    const user = userEvent.setup()
    renderComic()

    await user.click(screen.getByRole('button', { name: '开始播读' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/tts')
    const player = screen.getByRole('group', { name: '绘本播读控制' })
    await waitFor(() => expect(within(player).getByText(`1 / ${segmentCount}`)).toBeInTheDocument())
    expect(within(player).getByText('播读中 · 自然音色')).toBeInTheDocument()
  })

  it('pauses on the second press instead of re-reading the same sentence', async () => {
    const user = userEvent.setup()
    renderComic()

    await user.click(screen.getByRole('button', { name: '开始播读' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    const pauseButton = await screen.findByRole('button', { name: '暂停播读' })
    await user.click(pauseButton)

    const player = screen.getByRole('group', { name: '绘本播读控制' })
    await waitFor(() => expect(within(player).getByText('已暂停')).toBeInTheDocument())
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    // 回归断言：暂停不能重新请求语音，也不能把句子序号往前推
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(within(player).getByText(`1 / ${segmentCount}`)).toBeInTheDocument()
  })

  it('stops reading and returns the player to its idle label', async () => {
    const user = userEvent.setup()
    renderComic()

    await user.click(screen.getByRole('button', { name: '开始播读' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '停止播读' }))

    const player = screen.getByRole('group', { name: '绘本播读控制' })
    await waitFor(() => expect(within(player).getByText(`${segmentCount} 句`)).toBeInTheDocument())
    expect(within(player).getByRole('button', { name: '开始播读' })).toBeInTheDocument()
    expect(speech.cancel).toHaveBeenCalled()
  })

  it('starts from the comic page the student taps', async () => {
    const user = userEvent.setup()
    renderComic()

    await user.click(screen.getByRole('img', { name: '飞船内' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))
    expect(body.text).toBe('小多说：嘀嘀！我是小多！AI探险队，集合啦！')
  })
})
