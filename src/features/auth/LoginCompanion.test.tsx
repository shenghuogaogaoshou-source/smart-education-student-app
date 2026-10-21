import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { defaultState } from '../../app/model'
import { saveState } from '../../app/storage'
import { LoginCompanion } from '../ai_companion/LoginCompanion'

function renderCompanion() {
  saveState(defaultState)
  const onBoundsChange = vi.fn()
  render(
    <AppStateProvider>
      <LoginCompanion onBoundsChange={onBoundsChange} />
    </AppStateProvider>,
  )
  return { onBoundsChange }
}

describe('login companion', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the equipped primary companion', () => {
    renderCompanion()

    expect(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '和绒桃 Momo互动' })).toBeInTheDocument()
  })

  it('answers login voice input through the stage-free proxy and respects muted speech', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('PointerEvent', MouseEvent)
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null as ((event: unknown) => void) | null,
      onerror: null, onend: null as (() => void) | null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    vi.stubGlobal('SpeechRecognition', function () { return recognition })
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak })
    vi.stubGlobal('SpeechSynthesisUtterance', function () {})
    const requests: unknown[] = []
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
      requests.push(JSON.parse(options.body as string))
      return new Response(JSON.stringify({ reply: '水滴聚在一起，就变成了雨。' }))
    })
    saveState({ ...defaultState, voiceEnabled: false })
    render(<AppStateProvider><LoginCompanion onBoundsChange={() => undefined} /></AppStateProvider>)
    const button = screen.getByRole('button', { name: '和绒桃 Momo互动' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(600))
    fireEvent.pointerUp(button)
    await act(async () => {
      recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: '为什么会下雨？' } }] })
      recognition.onend?.()
    })
    expect(requests).toEqual([{ companionId: 'momo', question: '为什么会下雨？' }])
    expect(screen.getByRole('status')).toHaveTextContent('水滴聚在一起，就变成了雨。')
    expect(speak).not.toHaveBeenCalled()
  })

  it('places the companion inside a compact circular login frame', () => {
    renderCompanion()

    const frame = screen.getByTestId('login-companion-frame')
    expect(frame).toContainElement(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' }))
  })

  it('responds with varied pet-like reactions on consecutive short taps', async () => {
    const user = userEvent.setup()
    renderCompanion()
    const companion = screen.getByRole('button', { name: '和绒桃 Momo互动' })

    await user.click(companion)
    const firstReaction = screen.getByRole('status').textContent
    expect(firstReaction).toContain('准备好')

    await user.click(companion)
    expect(screen.getByRole('status').textContent).not.toBe(firstReaction)
  })

  it('cancels long press when the finger moves beyond the drag threshold', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null, onerror: null, onend: null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    renderCompanion()
    const button = screen.getByRole('button', { name: '和绒桃 Momo互动' })

    fireEvent.pointerDown(button, { pointerId: 8, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(button, { pointerId: 8, clientX: 40, clientY: 20 })
    act(() => vi.advanceTimersByTime(650))
    fireEvent.pointerUp(button, { pointerId: 8, clientX: 40, clientY: 20 })

    expect(recognition.start).not.toHaveBeenCalled()
    expect(screen.queryByText('请说，我在听')).not.toBeInTheDocument()
  })

  it('starts voice listening beside the companion after a 600ms long press', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '',
      continuous: false,
      interimResults: false,
      maxAlternatives: 0,
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    renderCompanion()
    const button = screen.getByRole('button', { name: '和绒桃 Momo互动' })

    fireEvent.pointerDown(button)
    act(() => vi.advanceTimersByTime(650))

    expect(screen.queryByRole('dialog', { name: '语音聊天体验' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('请说，我在听')
    expect(recognition.start).toHaveBeenCalledTimes(1)
  })

  it('shows the interim transcript in the same bubble while the child is still speaking', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null as ((event: unknown) => void) | null,
      onerror: null, onend: null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    renderCompanion()
    const button = screen.getByRole('button', { name: '和绒桃 Momo互动' })

    fireEvent.pointerDown(button, { pointerId: 12, button: 0 })
    act(() => vi.advanceTimersByTime(650))
    act(() => recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: '彩虹为什么' } }],
    }))

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('彩虹为什么')
    expect(screen.getByTestId('partner-appearance')).toHaveAttribute('data-motion', 'listen')
  })

  it('keeps listening when a held finger drifts outside the companion before the threshold', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null, onerror: null, onend: null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    renderCompanion()
    const button = screen.getByRole('button', { name: '和绒桃 Momo互动' })

    fireEvent.pointerDown(button, { pointerId: 7, button: 0 })
    fireEvent.pointerLeave(button, { pointerId: 7 })
    act(() => vi.advanceTimersByTime(650))

    expect(recognition.start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('请说，我在听')
  })

  it('stops recording on release so the spoken question can be sent', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null, onerror: null, onend: null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    renderCompanion()
    const button = screen.getByRole('button', { name: '和绒桃 Momo互动' })

    fireEvent.pointerDown(button, { pointerId: 9, button: 0 })
    act(() => vi.advanceTimersByTime(650))
    fireEvent.pointerUp(button, { pointerId: 9, button: 0 })

    expect(recognition.stop).toHaveBeenCalledTimes(1)
  })
})
