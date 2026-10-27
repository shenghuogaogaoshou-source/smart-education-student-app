import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../app/mobileApi'
import type { DayStory } from './content/storyContent'

// 播读最小单元：一段旁白、一句对话、或一个板块的文本
export type ReadSegment = {
  text: string
  anchor: string // 对应页面元素 id，用于高亮与自动滚动
  panelIndex: number | null // 属于第几页绘本；null 表示目标/小课堂/挑战等板块
}
// 把一天的故事展开成按顺序朗读的句子列表
export function buildStorySegments(story: DayStory): ReadSegment[] {
  const segments: ReadSegment[] = []

  segments.push({ text: `今天的目标：${story.goal}`, anchor: 'story-goal', panelIndex: null })

  story.panels.forEach((panel, i) => {
    const anchor = `story-panel-${i}`
    if (panel.narration) segments.push({ text: panel.narration, anchor, panelIndex: i })
    for (const line of panel.dialog) {
      segments.push({ text: `${line.speaker}说：${line.line}`, anchor, panelIndex: i })
    }
    if (!panel.narration && panel.dialog.length === 0) {
      segments.push({ text: `第${i + 1}页`, anchor, panelIndex: i })
    }
  })

  segments.push({ text: `博士星小课堂。${story.miniLesson.text}`, anchor: 'story-lesson', panelIndex: null })
  segments.push({ text: `闯关小挑战。${story.challenge.question}`, anchor: 'story-challenge', panelIndex: null })
  segments.push({ text: `小提示。${story.challenge.answer}`, anchor: 'story-challenge', panelIndex: null })

  return segments
}

// 本地语音：优先挑选音色柔和的中文语音
function pickZhVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const zh = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'))
  if (zh.length === 0) return null
  return (
    zh.find((v) => /natural|xiaoxiao|yaoyao|huihui|kangkang|yunyang|liwen|tingting|meijia/i.test(v.name)) ?? zh[0]
  )
}

export type ReadAloudStatus = 'idle' | 'playing' | 'paused'
export type ReadAloudEngine = 'server' | 'local'

export function useReadAloud(segments: ReadSegment[]) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [status, setStatus] = useState<ReadAloudStatus>('idle')
  const [index, setIndex] = useState(-1)
  const [engine, setEngine] = useState<ReadAloudEngine>('local')

  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const indexRef = useRef(-1)
  const activeRef = useRef(false)
  const speakAtRef = useRef<(i: number) => void>(() => {})
  const speakLocalRef = useRef<(i: number) => void>(() => {})

  // 服务端 TTS（Edge 神经语音）可用性：null = 未探测
  const serverOkRef = useRef<boolean | null>(null)
  const engineRef = useRef<ReadAloudEngine>('local')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlCacheRef = useRef(new Map<string, string>())

  const finish = useCallback(() => {
    activeRef.current = false
    indexRef.current = -1
    setIndex(-1)
    setStatus('idle')
    if (supported) window.speechSynthesis.cancel()
    audioRef.current?.pause()
  }, [supported])

  // ---------- 服务端神经语音 ----------
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current
    const audio = new Audio()
    audio.preload = 'auto'
    audio.onended = () => {
      if (activeRef.current) speakAtRef.current(indexRef.current + 1)
    }
    audio.onerror = () => {
      if (!activeRef.current || engineRef.current !== 'server') return
      serverOkRef.current = false
      speakLocalRef.current(indexRef.current)
    }
    audioRef.current = audio
    return audio
  }, [])

  const speakServerAt = useCallback(
    async (playIndex: number): Promise<boolean> => {
      const segment = segmentsRef.current[playIndex]
      if (!segment) return false
      try {
        let url = urlCacheRef.current.get(segment.text)
        if (!url) {
          const response = await apiFetch('/api/tts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: segment.text }),
          })
          if (!response.ok) throw new Error('tts_failed')
          const blob = await response.blob()
          if (!blob.type.startsWith('audio')) throw new Error('tts_failed')
          url = URL.createObjectURL(blob)
          urlCacheRef.current.set(segment.text, url)
        }
        const audio = ensureAudio()
        engineRef.current = 'server'
        serverOkRef.current = true
        setEngine('server')
        audio.src = url
        audio.currentTime = 0
        try {
          await audio.play()
        } catch (error) {
          // 用户快速暂停/跳转导致的 AbortError 属于正常中断
          if ((error as DOMException)?.name === 'AbortError') return true
          throw error
        }
        return true
      } catch {
        if (urlCacheRef.current.size === 0) serverOkRef.current = false
        return false
      }
    },
    [ensureAudio],
  )

  // ---------- 本地 speechSynthesis 兜底 ----------
  const speakLocalAt = useCallback(
    (playIndex: number) => {
      if (!supported) return
      const segment = segmentsRef.current[playIndex]
      if (!segment) return
      engineRef.current = 'local'
      setEngine('local')

      const synth = window.speechSynthesis
      synth.cancel()
      // cancel 后稍作停顿再 speak，规避 Chrome 偶发不发音的问题
      window.setTimeout(() => {
        if (!activeRef.current || indexRef.current !== playIndex) return
        const utterance = new SpeechSynthesisUtterance(segment.text)
        utterance.lang = 'zh-CN'
        utterance.rate = 0.95
        const voice = pickZhVoice()
        if (voice) utterance.voice = voice
        utterance.onend = () => {
          if (activeRef.current) speakAtRef.current(indexRef.current + 1)
        }
        utterance.onerror = (event) => {
          const reason = (event as SpeechSynthesisErrorEvent).error
          if (activeRef.current && reason !== 'canceled' && reason !== 'interrupted') {
            speakAtRef.current(indexRef.current + 1)
          }
        }
        synth.speak(utterance)
      }, 80)
    },
    [supported],
  )

  speakLocalRef.current = speakLocalAt

  const speakAt = useCallback(
    (nextIndex: number) => {
      if (!supported) return
      const list = segmentsRef.current
      if (nextIndex < 0 || nextIndex >= list.length) {
        finish()
        return
      }
      indexRef.current = nextIndex
      setIndex(nextIndex)
      setStatus('playing')

      // 停掉可能在播放的声音
      window.speechSynthesis.cancel()
      audioRef.current?.pause()

      if (serverOkRef.current !== false) {
        void speakServerAt(nextIndex).then((ok) => {
          if (!activeRef.current || ok) return
          speakLocalAt(nextIndex)
        })
      } else {
        speakLocalAt(nextIndex)
      }
    },
    [supported, finish, speakServerAt, speakLocalAt],
  )

  speakAtRef.current = speakAt

  const play = useCallback(
    (from?: number) => {
      if (!supported) return
      if (from === undefined && status === 'paused' && activeRef.current) {
        if (engineRef.current === 'server') {
          void audioRef.current?.play().catch(() => {})
        } else {
          window.speechSynthesis.resume()
        }
        setStatus('playing')
        return
      }
      activeRef.current = true
      speakAt(from ?? Math.max(indexRef.current, 0))
    },
    [supported, status, speakAt],
  )

  const pause = useCallback(() => {
    if (!supported || status !== 'playing') return
    if (engineRef.current === 'server') {
      audioRef.current?.pause()
    } else {
      window.speechSynthesis.pause()
    }
    setStatus('paused')
  }, [supported, status])

  const stop = useCallback(() => finish(), [finish])

  const next = useCallback(() => {
    if (indexRef.current >= 0) speakAt(Math.min(indexRef.current + 1, segmentsRef.current.length - 1))
  }, [speakAt])

  const prev = useCallback(() => {
    if (indexRef.current > 0) speakAt(indexRef.current - 1)
  }, [speakAt])

  // 切换故事（segments 变化）或卸载时停止播读
  useEffect(() => {
    if (!supported) return
    // 触发一次语音列表加载，避免首次本地播报拿不到中文语音
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {}
    return () => {
      activeRef.current = false
      window.speechSynthesis.cancel()
      audioRef.current?.pause()
      for (const url of urlCacheRef.current.values()) URL.revokeObjectURL(url)
      urlCacheRef.current.clear()
    }
  }, [supported, segments])

  return {
    supported,
    status,
    index,
    engine,
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    play,
    pause,
    stop,
    next,
    prev,
  }
}
