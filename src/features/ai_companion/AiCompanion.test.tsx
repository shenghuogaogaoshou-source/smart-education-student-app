import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState } from '../../app/companionAccountRepository'
import { defaultState } from '../../app/model'
import { saveState } from '../../app/storage'
import { AiCompanion } from './AiCompanion'
import { HANDOFF_DURATION_MS } from './CompanionHandoff'
import { classifyDemoCommand } from './safety'

const savedMatchMedia = window.matchMedia
const savedInnerHeight = window.innerHeight

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: savedMatchMedia })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: savedInnerHeight })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('temporary AI companion', () => {
  it.each(['null', '{bad', JSON.stringify({ version: 2 }), JSON.stringify({ version: 3, companionId: 'momo', loadoutVersion: 1, startRect: { width: -1 }, target: 'floating' })])('discards invalid handoff records without hiding the control', (record) => {
    sessionStorage.setItem('student-app-login-companion-bounds', record)
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)
    expect(screen.getByRole('button', { name: 'AI伙伴' })).toBeVisible()
    expect(screen.queryByTestId('companion-handoff')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('student-app-login-companion-bounds')).toBeNull()
  })

  it('clamps a drag to the frame, snaps to its edge and remembers the position on remount', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 200, top: 0, right: 660, bottom: 700, width: 460, height: 700 } as DOMRect)
    const tree = <div className="app-frame"><AppStateProvider><AiCompanion /></AppStateProvider></div>
    const view = render(tree)
    const control = screen.getByRole('button', { name: 'AI伙伴' })
    fireEvent.pointerDown(control, { clientX: 600, clientY: 500 })
    fireEvent.pointerMove(control, { clientX: -100, clientY: 2000 })
    fireEvent.pointerUp(control, { clientX: -100, clientY: 2000 })
    fireEvent.click(control)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(control).toHaveStyle({ left: '247px', top: '574px' })
    expect(loadAccountState(defaultState.accountId).aiPosition.x).toBeCloseTo(47 / 460)
    expect(loadAccountState(defaultState.accountId).aiPosition.y).toBeCloseTo(574 / 700)
    view.unmount()
    render(tree)
    expect(screen.getByRole('button', { name: 'AI伙伴' })).toHaveStyle({ left: '247px', top: '574px' })
  })

  it('follows test-map targets with a temporary running motion without changing drag memory', () => {
    vi.useFakeTimers()
    const view = render(<AppStateProvider><AiCompanion placement="test-map" mapTarget={{ id: 'a', x: 30, y: 40 }} /></AppStateProvider>)
    expect(screen.getByRole('button', { name: 'AI伙伴' })).toHaveStyle({ left: '30%', bottom: '40%' })
    view.rerender(<AppStateProvider><AiCompanion placement="test-map" mapTarget={{ id: 'b', x: 65, y: 70 }} /></AppStateProvider>)
    expect(screen.getByRole('button', { name: 'AI伙伴' })).toHaveStyle({ left: '65%', bottom: '70%' })
    expect(screen.getByTestId('partner-appearance')).toHaveAttribute('data-motion', 'run')
    act(() => vi.advanceTimersByTime(820))
    expect(screen.getByTestId('partner-appearance')).toHaveAttribute('data-motion', 'idle')
    expect(loadAccountState(defaultState.accountId).aiPosition).toEqual({ x: .88, y: .84 })
  })

  it('displays and speaks the proxy reply after long-press speech input using the equipped identity', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('PointerEvent', MouseEvent)
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null as ((event: unknown) => void) | null,
      onerror: null, onend: null as (() => void) | null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    vi.stubGlobal('SpeechRecognition', function () { return recognition })
    const spoken: string[] = []
    vi.stubGlobal('SpeechSynthesisUtterance', function (this: { text: string }, text: string) { this.text = text })
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: (utterance: { text: string }) => spoken.push(utterance.text) })
    const requests: unknown[] = []
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
      requests.push(JSON.parse(options.body as string))
      return new Response(JSON.stringify({ reply: '可以多拍几张清晰的叶子照片。' }))
    })
    saveState({ ...defaultState, voiceEnabled: true, companion: { ...defaultState.companion, owned: { ...defaultState.companion.owned, appearance: ['momo', 'yunduo'] }, equipped: { ...defaultState.companion.equipped, appearance: 'yunduo' } } })
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)
    const control = screen.getByRole('button', { name: 'AI伙伴' })
    fireEvent.pointerDown(control)
    act(() => vi.advanceTimersByTime(600))
    fireEvent.pointerUp(control)
    await act(async () => {
      recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: '怎么让植物识别更准确？' } }] })
      recognition.onend?.()
    })
    expect(requests).toEqual([{ companionId: 'yunduo', question: '怎么让植物识别更准确？' }])
    expect(screen.getByRole('status')).toHaveTextContent('可以多拍几张清晰的叶子照片。')
    expect(spoken).toEqual(['可以多拍几张清晰的叶子照片。'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('starts in the lower-right safe zone above the bottom navigation', () => {
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)

    const control = screen.getByRole('button', { name: 'AI伙伴' })
    expect(control.style.left).toBe('88vw')
    expect(control.style.top).toBe('78vh')
    expect(control).toHaveClass('is-on-right-side')
  })

  it('keeps the companion in the visible lower-right corner of a tall app frame', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('app-frame')) {
        return { left: 200, top: 0, right: 660, bottom: 1600, width: 460, height: 1600 } as DOMRect
      }
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
    })

    render(<div className="app-frame"><AppStateProvider><AiCompanion /></AppStateProvider></div>)

    expect(screen.getByRole('button', { name: 'AI伙伴' })).toHaveStyle({
      left: '604.8px',
      top: '672px',
    })
  })

  it('renders the equipped layered companion instead of the legacy bot icon', () => {
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)

    const control = screen.getByRole('button', { name: 'AI伙伴' })
    expect(within(control).getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
    expect(within(control).queryByText('AI')).not.toBeInTheDocument()
  })

  it('keeps tap and chat available after an appearance, outfit, and decoration are equipped', async () => {
    const user = userEvent.setup()
    saveState({
      ...defaultState,
      companion: {
        owned: {
          appearance: ['momo', 'yunduo'],
          outfit: ['cloud-backpack'],
          decoration: ['cloud-flower-lamp'],
        },
        equipped: {
          appearance: 'yunduo',
          outfit: 'cloud-backpack',
          decoration: 'cloud-flower-lamp',
        },
        version: 1,
      },
    })
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)

    const control = screen.getByRole('button', { name: 'AI伙伴' })
    expect(within(control).getByRole('img', { name: '云朵 Yunduo AI 伙伴形象' })).toBeInTheDocument()
    expect(within(control).getByTestId('companion-outfit')).toBeInTheDocument()
    expect(within(control).getByTestId('companion-decoration')).toBeInTheDocument()
    await user.click(control)
    expect(screen.getByRole('status')).toHaveTextContent('继续上次')
    await user.click(control)
    expect(screen.getByRole('dialog', { name: 'AI 学习伙伴' })).toBeInTheDocument()
  })

  it('uses the saved login bounds once and clears the handoff record after the animation', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('app-frame')) {
        return { left: 200, top: 0, right: 660, bottom: 1600, width: 460, height: 1600 } as DOMRect
      }
      if (this.classList.contains('ai-companion-control')) {
        return { left: 300, top: 500, right: 370, bottom: 570, width: 70, height: 70 } as DOMRect
      }
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
    })
    sessionStorage.setItem('student-app-login-companion-bounds', JSON.stringify({
      version: 3,
      companionId: 'momo',
      loadoutVersion: 1,
      startRect: { left: 40, top: 80, right: 220, bottom: 260, width: 180, height: 180 },
      target: 'floating',
    }))

    render(<div className="app-frame"><AppStateProvider><AiCompanion /></AppStateProvider></div>)

    const handoff = screen.getByTestId('companion-handoff')
    expect(handoff).toHaveAttribute('data-handoff-status', 'running')
    expect(handoff).toHaveAttribute('data-handoff-motion', 'idle')
    expect(handoff).toHaveStyle({
      left: '40px',
      top: '80px',
      width: '180px',
      height: '180px',
      '--handoff-dx': '260px',
      '--handoff-dy': '420px',
    })
    expect(Number(handoff.style.getPropertyValue('--handoff-scale-x'))).toBeCloseTo(70 / 180)
    act(() => vi.advanceTimersByTime(260))
    expect(screen.getByTestId('companion-handoff')).toHaveAttribute('data-handoff-motion', 'wave')
    act(() => vi.advanceTimersByTime(350))
    expect(screen.getByTestId('companion-handoff')).toHaveAttribute('data-handoff-motion', 'walk')
    act(() => vi.advanceTimersByTime(HANDOFF_DURATION_MS))
    expect(screen.queryByTestId('companion-handoff')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('student-app-login-companion-bounds')).toBeNull()
  })

  it('skips the handoff when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
    sessionStorage.setItem('student-app-login-companion-bounds', JSON.stringify({
      version: 3,
      companionId: 'momo',
      loadoutVersion: 1,
      startRect: { left: 40, top: 80, right: 220, bottom: 260, width: 180, height: 180 },
      target: 'floating',
    }))

    render(<AppStateProvider><AiCompanion /></AppStateProvider>)

    expect(screen.queryByTestId('companion-handoff')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
    expect(sessionStorage.getItem('student-app-login-companion-bounds')).toBeNull()
  })

  it('classifies unclear and risk-sensitive demo commands deterministically', () => {
    expect(classifyDemoCommand('那个帮我弄一下')).toBe('unclear')
    expect(classifyDemoCommand('把明天的学习安排改到晚上')).toBe('medium')
    expect(classifyDemoCommand('帮我修改账号密码')).toBe('high')
    expect(classifyDemoCommand('你真蠢')).toBe('blocked')
    expect(classifyDemoCommand('打开我的作品')).toBe('safe')
  })

  it('shows a page-aware reaction first and opens the assistant on a second tap', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)
    const companion = screen.getByRole('button', { name: 'AI伙伴' })

    await user.click(companion)
    expect(screen.getByRole('status')).toHaveTextContent('继续上次')
    expect(screen.queryByRole('dialog', { name: 'AI 学习伙伴' })).not.toBeInTheDocument()

    await user.click(companion)
    expect(screen.getByRole('dialog', { name: 'AI 学习伙伴' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '输入想问的问题' })).toBeInTheDocument()
  })

  it('keeps test-map taps as short level reactions instead of opening the full assistant', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><AiCompanion placement="test-map" mapTarget={{ id: 'a', x: 30, y: 40 }} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: 'AI伙伴' }))
    await user.click(screen.getByRole('button', { name: 'AI伙伴' }))

    expect(screen.getByRole('status')).toHaveTextContent('关')
    expect(screen.queryByRole('dialog', { name: 'AI 学习伙伴' })).not.toBeInTheDocument()
  })

  it('starts voice listening in a small companion bubble after a deliberate long press', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null, onerror: null, onend: null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)
    const control = screen.getByRole('button', { name: 'AI伙伴' })

    fireEvent.pointerDown(control, { clientX: 300, clientY: 500, pointerId: 1 })
    act(() => vi.advanceTimersByTime(650))
    fireEvent.pointerUp(control, { clientX: 300, clientY: 500, pointerId: 1 })

    expect(screen.queryByRole('dialog', { name: 'AI 学习伙伴' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('请说，我在听')
    expect(recognition.start).toHaveBeenCalledTimes(1)
  })

  it('aborts voice capture on pointer cancel instead of submitting a partial question', () => {
    vi.useFakeTimers()
    const recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 0,
      onresult: null, onerror: null, onend: null,
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    }
    const SpeechRecognitionMock = function () { return recognition } as unknown as new () => typeof recognition
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechRecognitionMock })
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)
    const control = screen.getByRole('button', { name: 'AI伙伴' })

    fireEvent.pointerDown(control, { clientX: 300, clientY: 500, pointerId: 11 })
    act(() => vi.advanceTimersByTime(650))
    fireEvent.pointerCancel(control, { clientX: 300, clientY: 500, pointerId: 11 })

    expect(recognition.abort).toHaveBeenCalledTimes(1)
    expect(recognition.stop).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'AI 学习伙伴' })).not.toBeInTheDocument()
  })
})
