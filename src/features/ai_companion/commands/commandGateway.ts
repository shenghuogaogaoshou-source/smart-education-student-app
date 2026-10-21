import type {
  CommandDecision,
  CommandGatewayState,
  CompanionCommand,
  ExecutableCommand,
} from './commandTypes'

const LOW_RISK = new Set([
  'navigate',
  'continue-learning',
  'resume-game',
  'search-course',
  'play-course',
  'show-points',
  'show-medals',
])

const MEDIUM_RISK = new Set([
  'purchase',
  'equip',
  'unequip',
  'submit-test',
  'publish-work',
  'post-comment',
  'update-schedule',
  'replace-progress',
])

const HIGH_RISK = new Set([
  'update-account-security',
  'view-guardian',
  'update-guardian',
  'clear-account-data',
  'sign-out-devices',
  'delete-account',
])

const HIGH_RISK_TITLES: Record<string, string> = {
  'update-account-security': '修改账号安全设置',
  'view-guardian': '查看监护人信息',
  'update-guardian': '修改监护人信息',
  'clear-account-data': '清空学习账号数据',
  'sign-out-devices': '退出其他登录设备',
  'delete-account': '删除学习账号',
}

const NAVIGATION_TARGETS = new Set(['home', 'knowledge', 'test', 'profile', 'settings', 'mall', 'points', 'medals', 'schedule'])

function hasExactKeys(record: Record<string, unknown>, allowed: string[]) {
  return Object.keys(record).every((key) => allowed.includes(key))
}

function validIdentifier(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidCommand(command: Record<string, unknown>) {
  const type = command.type
  if (type === 'navigate') return hasExactKeys(command, ['type', 'target']) && NAVIGATION_TARGETS.has(String(command.target))
  if (['continue-learning', 'show-points', 'show-medals', ...HIGH_RISK].includes(String(type))) {
    return hasExactKeys(command, ['type'])
  }
  if (type === 'purchase' || type === 'equip') return hasExactKeys(command, ['type', 'itemId']) && validIdentifier(command.itemId)
  if (type === 'unequip') return hasExactKeys(command, ['type', 'category']) && (command.category === 'outfit' || command.category === 'decoration')
  if (type === 'resume-game') return hasExactKeys(command, ['type', 'gameId']) && (command.gameId === undefined || validIdentifier(command.gameId))
  if (type === 'search-course') return hasExactKeys(command, ['type', 'query']) && typeof command.query === 'string' && command.query.trim().length > 0
  if (type === 'play-course') {
    return hasExactKeys(command, ['type', 'courseId', 'chapterNum'])
      && validIdentifier(command.courseId)
      && (command.chapterNum === undefined || (Number.isInteger(command.chapterNum) && Number(command.chapterNum) > 0))
  }
  if (type === 'submit-test' || type === 'publish-work' || type === 'update-schedule') {
    const key = type === 'submit-test' ? 'partId' : type === 'publish-work' ? 'workId' : 'scheduleId'
    return hasExactKeys(command, ['type', key]) && (command[key] === undefined || validIdentifier(command[key]))
  }
  if (type === 'post-comment') {
    return hasExactKeys(command, ['type', 'workId', 'text'])
      && validIdentifier(command.workId)
      && typeof command.text === 'string'
      && command.text.trim().length > 0
  }
  if (type === 'replace-progress') return hasExactKeys(command, ['type', 'partId']) && validIdentifier(command.partId)
  return false
}

function resolveItemCommand(command: CompanionCommand, state: CommandGatewayState): ExecutableCommand | null {
  if (command.type !== 'purchase' && command.type !== 'equip') return command
  const item = state.catalog.find((candidate) => candidate.id === command.itemId)
  if (!item) return null
  return { ...command, resolvedItem: item }
}

function mediumTitle(command: ExecutableCommand) {
  if (command.type === 'purchase' && command.resolvedItem) {
    return `确认使用 ${command.resolvedItem.price} 积分购买${command.resolvedItem.name}`
  }
  if (command.type === 'equip' && command.resolvedItem) return `确认换上${command.resolvedItem.name}`
  if (command.type === 'unequip') return command.category === 'outfit' ? '确认卸下当前服饰' : '确认卸下当前装饰'
  if (command.type === 'submit-test') return '确认提交本次测试'
  if (command.type === 'publish-work') return '确认发布这份作品'
  if (command.type === 'post-comment') return '确认发表这条留言'
  if (command.type === 'update-schedule') return '确认修改学习安排'
  return '确认替换当前学习进度'
}

export function evaluateCommand(command: CompanionCommand, state: CommandGatewayState): CommandDecision {
  if (!isRecord(command) || typeof command.type !== 'string' || !isValidCommand(command)) {
    return { kind: 'reject', message: '这个操作不在我能安全完成的范围里。' }
  }

  if (LOW_RISK.has(command.type)) {
    return {
      kind: 'execute',
      command,
      message: '好，我们现在就去。',
    }
  }

  if (MEDIUM_RISK.has(command.type)) {
    const resolved = resolveItemCommand(command, state)
    if (!resolved) return { kind: 'reject', message: '我没有找到这个商品，请到积分商城再看看。' }
    if (resolved.type === 'purchase' && resolved.resolvedItem) {
      if (state.ownedItemIds.includes(resolved.itemId)) {
        return { kind: 'reject', message: '这个商品已经在“我的”里面啦。' }
      }
      if (!Number.isFinite(resolved.resolvedItem.price) || resolved.resolvedItem.price <= 0 || state.pointsBalance < resolved.resolvedItem.price) {
        return { kind: 'reject', message: '现在的积分还不够，我们先去完成学习任务吧。' }
      }
    }
    if (resolved.type === 'equip' && !state.ownedItemIds.includes(resolved.itemId)) {
      return { kind: 'reject', message: '这个商品还没有购买，暂时不能装上。' }
    }
    return {
      kind: 'confirm',
      command: resolved,
      title: mediumTitle(resolved),
      message: '这是需要你在屏幕上确认的操作。',
    }
  }

  if (HIGH_RISK.has(command.type)) {
    return {
      kind: 'password',
      command,
      title: HIGH_RISK_TITLES[command.type] ?? '验证当前账号密码',
      message: '这是重要操作，需要输入当前账号密码才能继续。',
    }
  }

  return { kind: 'reject', message: '这个操作不在我能安全完成的范围里。' }
}
