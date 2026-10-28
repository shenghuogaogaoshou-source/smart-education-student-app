import { ArrowLeft, Bookmark, Brain, History, Mic, Send, Settings2, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../../app/AppState'
import type { ConversationSummary, VoiceReplyMode } from '../../app/model'
import { AiLocalSheet } from './AiLocalSheet'
import { getCompanionDisplayName } from './companionCatalog'
import { requestCompanionReply } from './companionChat'
import { startSpeechCapture, speakCompanionReply, type SpeechPlayback } from './browserSpeech'
import { useOptionalAppCommand } from './commands/AppCommandContext'
import { createConversationController, type ConversationSnapshot } from './conversation/conversationMachine'
import { CompanionRotator } from './render2d/CompanionRotator'

type ChatMessage = {
  id: number
  role: 'student' | 'partner'
  text: string
}

const APP_COMMAND_PATTERN = /^(打开|进入|跳到|返回|回到|继续|接着|查看|显示|购买|买下|换上|卸下|提交|发布|清空|退出|删除|修改|更新|把.+(?:安排|进度|服饰|装饰))/

export function looksLikeAppCommand(text: string) {
  return APP_COMMAND_PATTERN.test(text.trim())
}

export function shouldSpeakReply(mode: VoiceReplyMode, source: 'voice' | 'text', voiceEnabled: boolean) {
  if (!voiceEnabled || mode === 'silent') return false
  return mode === 'always' || source === 'voice'
}

function errorMessage(conversation: ConversationSnapshot) {
  if (conversation.errorReason === 'permission-denied') return '麦克风还没有获得允许，可以在设置里检查权限。'
  if (conversation.errorReason === 'no-speech' || conversation.errorReason === 'not-supported') return '我没有听清楚，可以靠近一点再说一次吗？'
  if (conversation.errorReason === 'request-error') return '伙伴的知识问答服务还没连接好，先试试“打开知识”或“继续学习”吧。'
  return '刚才没有听清楚，可以再说一次吗？'
}

type ConversationHistoryGroup = {
  label: '今天' | '昨天' | '更早'
  items: ConversationSummary[]
}

function groupConversationSummaries(summaries: ConversationSummary[]): ConversationHistoryGroup[] {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const groups: ConversationHistoryGroup[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '更早', items: [] },
  ]

  for (const summary of [...summaries].reverse()) {
    const date = new Date(summary.occurredAt)
    if (!Number.isFinite(date.getTime())) continue
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayOffset = Math.round((startOfToday - startOfDate) / 86_400_000)
    const groupIndex = dayOffset === 0 ? 0 : dayOffset === 1 ? 1 : 2
    groups[groupIndex].items.push(summary)
  }

  return groups.filter((group) => group.items.length > 0)
}

export function AiPanel({ onClose, onOpenPrivacySettings }: {
  onClose: () => void
  onOpenPrivacySettings?: () => void
}) {
  const app = useAppState()
  const { state } = app
  const appearanceName = getCompanionDisplayName(state.companion.equipped.appearance)
  const command = useOptionalAppCommand()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'partner', text: `你好，我是${appearanceName}。想一起弄明白什么？` },
  ])
  const [conversation, setConversation] = useState<ConversationSnapshot>({
    status: 'idle',
    interimText: '',
    question: '',
    reply: '',
    errorReason: null,
  })
  const [localPanel, setLocalPanel] = useState<'history' | 'settings' | null>(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const messageIdRef = useRef(2)
  const lastQuestionRef = useRef('')
  const lastReplyRef = useRef('')
  const lastErrorRef = useRef(false)
  const sourceRef = useRef<'voice' | 'text'>('text')
  const commandRef = useRef(command)
  const voiceModeRef = useRef(state.voiceReplyMode)
  const voiceEnabledRef = useRef(state.voiceEnabled)
  const companionIdRef = useRef(state.companion.equipped.appearance ?? 'momo')
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const historyTriggerRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const playbackRef = useRef<SpeechPlayback | null>(null)
  commandRef.current = command
  voiceModeRef.current = state.voiceReplyMode
  voiceEnabledRef.current = state.voiceEnabled
  companionIdRef.current = state.companion.equipped.appearance ?? 'momo'

  const appendMessage = (role: ChatMessage['role'], text: string) => {
    const normalized = text.trim()
    if (!normalized) return
    setMessages((current) => [...current, { id: messageIdRef.current++, role, text: normalized }])
  }

  const [conversationController] = useState(() => createConversationController({
    startCapture: startSpeechCapture,
    requestReply: async ({ companionId, question, signal, onDelta }) => {
      if (looksLikeAppCommand(question)) {
        if (!commandRef.current) return '现在还没有连接应用控制，可以先问我一个学习问题。'
        const result = await commandRef.current.submitText(question, sourceRef.current)
        return result.message
      }
      return requestCompanionReply({ companionId, question, signal, onDelta })
    },
    speakReply: speakCompanionReply,
    getCompanionId: () => companionIdRef.current,
    getVoiceEnabled: () => shouldSpeakReply(voiceModeRef.current, sourceRef.current, voiceEnabledRef.current),
  }))

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
      conversationController.cancel()
      playbackRef.current?.cancel()
    }
  }, [conversationController])

  useEffect(() => {
    const unsubscribe = conversationController.subscribe(setConversation)
    return () => {
      unsubscribe()
    }
  }, [conversationController])

  useEffect(() => {
    if (conversation.question && conversation.question !== lastQuestionRef.current) {
      lastQuestionRef.current = conversation.question
      appendMessage('student', conversation.question)
    }
    if (conversation.reply && conversation.reply !== lastReplyRef.current) {
      lastReplyRef.current = conversation.reply
      appendMessage('partner', conversation.reply)
    }
    if (conversation.status === 'error' && !lastErrorRef.current) {
      lastErrorRef.current = true
      appendMessage('partner', errorMessage(conversation))
    }
    if (conversation.status !== 'error') lastErrorRef.current = false
  }, [conversation])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages])

  const resetMessageTracking = (source: 'voice' | 'text') => {
    sourceRef.current = source
    lastQuestionRef.current = ''
    lastReplyRef.current = ''
    lastErrorRef.current = false
  }

  const submitInput = (event: FormEvent) => {
    event.preventDefault()
    const question = input.trim()
    if (!question || conversation.status === 'thinking') return
    resetMessageTracking('text')
    setInput('')
    void conversationController.submitText(question)
  }

  const startVoice = () => {
    if (conversation.status === 'listening' || conversation.status === 'transcribing') return
    resetMessageTracking('voice')
    conversationController.start()
  }

  const stopVoice = () => conversationController.stop()

  const handleVoicePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    startVoice()
  }

  const handleVoicePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    stopVoice()
  }

  const handleVoiceKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      startVoice()
    }
  }

  const handleVoiceKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') stopVoice()
  }

  const latestPartnerReply = [...messages].reverse().find((message) => message.role === 'partner')?.text ?? ''
  const playLatestReply = () => {
    if (!latestPartnerReply) return
    playbackRef.current?.cancel()
    playbackRef.current = speakCompanionReply(latestPartnerReply, true, () => {
      playbackRef.current = null
    })
  }

  const isConversing = messages.length > 1 || conversation.status !== 'idle'
  const busy = conversation.status === 'thinking' || conversation.status === 'speaking'
  const listening = conversation.status === 'listening' || conversation.status === 'transcribing'
  const historyGroups = groupConversationSummaries(state.conversationSummaries)

  const closeLocalPanel = () => {
    setLocalPanel(null)
    setConfirmClear(false)
  }

  const portal = (
    <div className="ai-panel-root" role="presentation">
      <section className={`ai-panel-full ${isConversing ? 'is-conversing' : ''}`} role="dialog" aria-modal="true" aria-label={`${appearanceName} 的对话`}>
        <header className="ai-chat-header">
          <button type="button" aria-label="关闭" onClick={onClose} className="ai-chat-header__button"><ArrowLeft size={21} /></button>
          <div><span>智芽成长伙伴</span><strong>{appearanceName}</strong></div>
          <div className="ai-chat-header__actions">
            <button ref={historyTriggerRef} type="button" aria-label="历史对话" className="ai-chat-header__button" onClick={() => setLocalPanel('history')}><History size={18} /></button>
            <button ref={settingsTriggerRef} type="button" aria-label="伙伴设置" className="ai-chat-header__button" onClick={() => setLocalPanel('settings')}><Settings2 size={18} /></button>
          </div>
        </header>

        <section className="ai-chat-companion" aria-label={`当前 AI 伙伴${appearanceName} 八方向预览`}>
          <div className="ai-chat-companion__art">
            <CompanionRotator
              loadout={state.companion}
              scene="chat"
              motion={conversation.status === 'thinking' ? 'think' : conversation.status === 'speaking' ? 'speak' : 'idle'}
              reduceMotion={state.reduceMotion}
            />
          </div>
          <div className="ai-chat-companion__copy">
            <span className="ai-chat-companion__level">Lv.7 · 好奇心探索员</span>
            <h1>{appearanceName}</h1>
            <p>{isConversing ? '我在认真听，也会陪你一步一步想清楚。' : '今天想一起发现什么？轻轻转动我，看看新装扮吧。'}</p>
            <span className="ai-chat-companion__privacy"><ShieldCheck size={13} /> 回答会遵守小学生安全规则</span>
          </div>
        </section>

        <main className="ai-chat-messages" role="log" aria-live="polite" aria-label="对话消息">
          {messages.map((message) => (
            <article key={message.id} className={`ai-chat-message ai-chat-message--${message.role}`}>
              <span>{message.role === 'student' ? '我' : appearanceName}</span>
              <p>{message.text}</p>
            </article>
          ))}
          {listening && (
            <div className="ai-chat-listening" role="status">
              <span />
              <span />
              <span />
              {conversation.interimText || '请说，我在听'}
            </div>
          )}
          {busy && <div className="ai-chat-thinking" role="status"><Sparkles size={15} /> {conversation.status === 'speaking' ? '伙伴正在回答' : '正在想一想'}</div>}
          {messages.length === 1 && (
            <div className="ai-chat-starters" aria-label="试试这样问">
              {['继续上次学习', '查看我的积分', '今天可以学什么？'].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setInput(suggestion)}>{suggestion}</button>
              ))}
            </div>
          )}
          <div ref={conversationEndRef} />
        </main>

        <footer className="ai-chat-composer">
          {command?.pending && command.message && <p className="ai-chat-command-status" role="status">{command.message}</p>}
          <div className="ai-chat-composer__utility">
            <span>文字或语音都可以，安全操作会先征求你的同意</span>
            <button type="button" aria-label="播放回答" onClick={playLatestReply} disabled={!latestPartnerReply}><Volume2 size={17} /> 播放回答</button>
          </div>
          <form className="ai-chat-input-row" onSubmit={submitInput}>
            <input
              aria-label="输入想问的问题"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="问伙伴一个安全、清楚的问题"
              maxLength={160}
            />
            <button
              type="button"
              className={`ai-chat-voice ${listening ? 'is-listening' : ''}`}
              aria-label="按住说话"
              aria-pressed={listening}
              onPointerDown={handleVoicePointerDown}
              onPointerUp={handleVoicePointerUp}
              onPointerCancel={stopVoice}
              onKeyDown={handleVoiceKeyDown}
              onKeyUp={handleVoiceKeyUp}
              onContextMenu={(event) => event.preventDefault()}
            >
              <Mic size={19} />
            </button>
            <button type="submit" className="ai-chat-send" aria-label="发送" disabled={!input.trim() || busy}><Send size={19} /></button>
          </form>
        </footer>

        {localPanel === 'history' && (
          <AiLocalSheet
            label="本机对话记录"
            eyebrow="仅保存在当前学习账号"
            title="本机对话记录"
            triggerRef={historyTriggerRef}
            onClose={closeLocalPanel}
            footer={(
              <button
                type="button"
                className="ai-local-sheet__clear"
                disabled={state.conversationSummaries.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                清空记录
              </button>
            )}
          >
            {confirmClear ? (
              <section className="ai-local-history-confirm" aria-label="清空记录确认">
                <History size={24} />
                <strong>确认清空本机对话记录？</strong>
                <p>只会删除当前学习账号保存在本设备上的对话摘要。</p>
                <div>
                  <button type="button" onClick={() => setConfirmClear(false)}>取消清空</button>
                  <button
                    type="button"
                    onClick={() => {
                      app.clearHistory()
                      setConfirmClear(false)
                    }}
                  >
                    确认清空
                  </button>
                </div>
              </section>
            ) : historyGroups.length > 0 ? (
              <div className="ai-history-groups">
                {historyGroups.map((group) => (
                  <section key={group.label} className="ai-history-group" aria-label={group.label}>
                    <h3>{group.label}</h3>
                    {group.items.map((summary) => {
                      const expanded = expandedHistoryId === summary.id
                      return (
                        <button
                          key={summary.id}
                          type="button"
                          className={`ai-history-card ${expanded ? 'is-expanded' : ''}`}
                          aria-expanded={expanded}
                          onClick={() => setExpandedHistoryId(expanded ? null : summary.id)}
                        >
                          <span className="ai-history-card__meta">
                            <time>{new Date(summary.occurredAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>
                            <b>{summary.messageCount} 条消息</b>
                          </span>
                          <strong>{summary.topic}</strong>
                          <p>{summary.summary}</p>
                        </button>
                      )
                    })}
                  </section>
                ))}
              </div>
            ) : (
              <div className="ai-chat-empty-state ai-chat-empty-state--compact">
                <History size={24} />
                <strong>还没有可回看的对话摘要</strong>
                <p>开启保存后，重要学习话题会整理在当前设备中，不会伪装成云端记录。</p>
              </div>
            )}
          </AiLocalSheet>
        )}

        {localPanel === 'settings' && (
          <AiLocalSheet
            label="伙伴设置"
            eyebrow="当前学习账号的本地偏好"
            title="伙伴设置"
            triggerRef={settingsTriggerRef}
            onClose={closeLocalPanel}
            footer={(
              <div className="ai-local-settings-footer">
                <span><ShieldCheck size={15} />设置只属于当前学习账号</span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenPrivacySettings?.()
                    closeLocalPanel()
                  }}
                >
                  管理全部隐私设置
                </button>
              </div>
            )}
          >
            <div className="ai-chat-setting-list ai-chat-setting-list--cards">
              <button
                type="button"
                role="switch"
                aria-label="切换语音回复"
                aria-checked={state.voiceReplyMode !== 'silent'}
                onClick={() => app.setVoiceReplyMode(state.voiceReplyMode === 'silent' ? 'voice-only' : 'silent')}
              >
                <span className="ai-setting-card__icon"><Volume2 size={18} /></span>
                <span><strong>语音回复</strong><small>长按提问后由伙伴读出回答</small></span>
                <em aria-hidden="true" />
              </button>
              <button
                type="button"
                role="switch"
                aria-label="保存对话摘要"
                aria-checked={state.saveHistory}
                onClick={() => app.setSaveHistory(!state.saveHistory)}
              >
                <span className="ai-setting-card__icon"><Bookmark size={18} /></span>
                <span><strong>保存对话摘要</strong><small>仅保存在当前学习账号与设备</small></span>
                <em aria-hidden="true" />
              </button>
              <button
                type="button"
                role="switch"
                aria-label="学习记忆"
                aria-checked={state.aiMemoryEnabled}
                onClick={() => app.setAiMemory(!state.aiMemoryEnabled)}
              >
                <span className="ai-setting-card__icon"><Brain size={18} /></span>
                <span><strong>学习记忆</strong><small>根据多次谈话整理长期学习偏好</small></span>
                <em aria-hidden="true" />
              </button>
            </div>
          </AiLocalSheet>
        )}
      </section>
    </div>
  )

  return createPortal(portal, document.body)
}
