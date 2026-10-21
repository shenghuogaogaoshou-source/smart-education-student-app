const COMPANION_IDS = new Set(['momo', 'yunduo', 'cloudbloom', 'cloudbelle'])
const NAVIGATION_TARGETS = new Set(['home', 'knowledge', 'test', 'profile', 'settings', 'mall', 'points', 'medals', 'schedule'])
const SIMPLE_COMMANDS = new Set([
  'continue-learning', 'show-points', 'show-medals',
  'update-account-security', 'view-guardian', 'update-guardian',
  'clear-account-data', 'sign-out-devices', 'delete-account',
])
const ITEM_COMMANDS = new Set(['purchase', 'equip'])
const KNOWN_COMMANDS = new Set([
  'navigate', ...SIMPLE_COMMANDS, ...ITEM_COMMANDS, 'unequip', 'resume-game',
  'search-course', 'play-course', 'submit-test', 'publish-work', 'post-comment',
  'update-schedule', 'replace-progress',
])
const MAX_INPUT_LENGTH = 160
const MAX_REPLY_LENGTH = 110

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(record, allowed) {
  return Object.keys(record).every((key) => allowed.includes(key))
}

function cleanText(value, fallback) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return (text || fallback).slice(0, MAX_REPLY_LENGTH)
}

function validIdentifier(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value)
}

function parseCommand(command) {
  if (!isRecord(command) || typeof command.type !== 'string') return null
  if (command.type === 'navigate') {
    if (!hasExactKeys(command, ['type', 'target']) || !NAVIGATION_TARGETS.has(command.target)) return null
    return { type: 'navigate', target: command.target }
  }
  if (SIMPLE_COMMANDS.has(command.type)) {
    if (!hasExactKeys(command, ['type'])) return null
    return { type: command.type }
  }
  if (ITEM_COMMANDS.has(command.type)) {
    if (!hasExactKeys(command, ['type', 'itemId']) || !validIdentifier(command.itemId)) return null
    return { type: command.type, itemId: command.itemId }
  }
  if (command.type === 'unequip') {
    if (!hasExactKeys(command, ['type', 'category']) || !['outfit', 'decoration'].includes(command.category)) return null
    return { type: 'unequip', category: command.category }
  }
  if (command.type === 'resume-game') {
    if (!hasExactKeys(command, ['type', 'gameId']) || (command.gameId !== undefined && !validIdentifier(command.gameId))) return null
    return command.gameId ? { type: 'resume-game', gameId: command.gameId } : { type: 'resume-game' }
  }
  if (command.type === 'search-course') {
    const query = typeof command.query === 'string' ? command.query.trim().slice(0, 60) : ''
    if (!hasExactKeys(command, ['type', 'query']) || !query) return null
    return { type: 'search-course', query }
  }
  if (command.type === 'play-course') {
    if (!hasExactKeys(command, ['type', 'courseId', 'chapterNum']) || !validIdentifier(command.courseId)) return null
    if (command.chapterNum !== undefined && (!Number.isInteger(command.chapterNum) || command.chapterNum < 1 || command.chapterNum > 100)) return null
    return command.chapterNum === undefined
      ? { type: 'play-course', courseId: command.courseId }
      : { type: 'play-course', courseId: command.courseId, chapterNum: command.chapterNum }
  }
  if (command.type === 'submit-test' || command.type === 'publish-work' || command.type === 'update-schedule') {
    const key = command.type === 'submit-test' ? 'partId' : command.type === 'publish-work' ? 'workId' : 'scheduleId'
    if (!hasExactKeys(command, ['type', key]) || (command[key] !== undefined && !validIdentifier(command[key]))) return null
    return command[key] ? { type: command.type, [key]: command[key] } : { type: command.type }
  }
  if (command.type === 'post-comment') {
    const text = typeof command.text === 'string' ? command.text.trim().replace(/\s+/g, ' ').slice(0, 140) : ''
    if (!hasExactKeys(command, ['type', 'workId', 'text']) || !validIdentifier(command.workId) || !text) return null
    return { type: 'post-comment', workId: command.workId, text }
  }
  if (command.type === 'replace-progress') {
    if (!hasExactKeys(command, ['type', 'partId']) || !validIdentifier(command.partId)) return null
    return { type: 'replace-progress', partId: command.partId }
  }
  return null
}

export function parseModelCommand(value) {
  if (!isRecord(value)) return { kind: 'clarify', reply: '我还没完全听懂，可以再具体说一点吗？' }
  if (value.kind === 'clarify') {
    return { kind: 'clarify', reply: cleanText(value.reply, '我还没完全听懂，可以再具体说一点吗？') }
  }
  if (value.kind === 'reject') {
    return { kind: 'reject', reply: cleanText(value.reply, '这个操作不在我能安全完成的范围里。') }
  }
  if (value.kind !== 'command') return { kind: 'clarify', reply: '我还没完全听懂，可以再具体说一点吗？' }
  if (isRecord(value.command) && typeof value.command.type === 'string' && !KNOWN_COMMANDS.has(value.command.type)) {
    return { kind: 'reject', reply: '这个操作不在我能安全完成的范围里。' }
  }
  const command = parseCommand(value.command)
  if (!command) return { kind: 'clarify', reply: '我听到了，不过还需要你把要做的事情说得更具体一点。' }
  return {
    kind: 'command',
    reply: cleanText(value.reply, '我可以帮你完成这个操作。'),
    command,
  }
}

export function buildIntentPayload({ companionId, text }) {
  const normalizedCompanionId = COMPANION_IDS.has(companionId) ? companionId : 'momo'
  const normalizedText = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ').slice(0, MAX_INPUT_LENGTH) : ''
  if (!normalizedText) throw new Error('invalid_intent')
  const allowed = [
    'navigate', 'continue-learning', 'resume-game', 'search-course', 'play-course', 'show-points', 'show-medals',
    'purchase', 'equip', 'unequip', 'submit-test', 'publish-work', 'post-comment', 'update-schedule', 'replace-progress',
    'update-account-security', 'view-guardian', 'update-guardian', 'clear-account-data', 'sign-out-devices', 'delete-account',
  ].join(', ')
  return {
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    temperature: 0,
    max_tokens: 260,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `你是“智芽”小学生 AI 伙伴 ${normalizedCompanionId} 的应用意图路由器。只返回 JSON，不使用 Markdown。允许命令：${allowed}。open-url、下载、系统设置、付款、发送隐私信息及任何未列出的命令绝不允许。明确且参数完整时返回 {"kind":"command","reply":"给学生的简短说明","command":{...}}；含糊或缺参数返回 {"kind":"clarify","reply":"一个温和的澄清问题"}；危险或越权返回 {"kind":"reject","reply":"简短安全说明"}。不能把“确认”当成屏幕确认或密码。`,
      },
      { role: 'user', content: normalizedText },
    ],
  }
}

export async function interpretCompanionIntent({ companionId, text, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('missing_api_key')
  const upstream = await fetchImpl('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildIntentPayload({ companionId, text })),
  })
  if (!upstream.ok) throw new Error('provider_error')
  const data = await upstream.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return { kind: 'clarify', reply: '我还没完全听懂，可以再说一次吗？' }
  try {
    return parseModelCommand(JSON.parse(content))
  } catch {
    return { kind: 'clarify', reply: '我还没完全听懂，可以再说一次吗？' }
  }
}
