import type { CompanionCategory } from '../../../app/model'

export type CommandSource = 'voice' | 'text'

export type CommandNavigationTarget =
  | 'home'
  | 'knowledge'
  | 'test'
  | 'profile'
  | 'settings'
  | 'mall'
  | 'points'
  | 'medals'
  | 'schedule'

export type CompanionCommand =
  | { type: 'navigate'; target: CommandNavigationTarget }
  | { type: 'continue-learning' }
  | { type: 'resume-game'; gameId?: string }
  | { type: 'search-course'; query: string }
  | { type: 'play-course'; courseId: string; chapterNum?: number }
  | { type: 'show-points' }
  | { type: 'show-medals' }
  | { type: 'purchase'; itemId: string }
  | { type: 'equip'; itemId: string }
  | { type: 'unequip'; category: Exclude<CompanionCategory, 'appearance'> }
  | { type: 'submit-test'; partId?: string }
  | { type: 'publish-work'; workId?: string }
  | { type: 'post-comment'; workId: string; text: string }
  | { type: 'update-schedule'; scheduleId?: string }
  | { type: 'replace-progress'; partId: string }
  | { type: 'update-account-security' }
  | { type: 'view-guardian' }
  | { type: 'update-guardian' }
  | { type: 'clear-account-data' }
  | { type: 'sign-out-devices' }
  | { type: 'delete-account' }

export type CommandCatalogItem = {
  id: string
  name: string
  category: CompanionCategory
  price: number
}

export type CommandGatewayState = {
  pointsBalance: number
  ownedItemIds: string[]
  catalog: CommandCatalogItem[]
}

export type ExecutableCommand = CompanionCommand & {
  resolvedItem?: CommandCatalogItem
}

export type CommandDecision =
  | { kind: 'execute'; command: ExecutableCommand; message: string }
  | { kind: 'confirm'; command: ExecutableCommand; title: string; message: string }
  | { kind: 'password'; command: ExecutableCommand; title: string; message: string }
  | { kind: 'clarify'; message: string }
  | { kind: 'reject'; message: string }

export type InterpretedIntent =
  | { kind: 'command'; reply: string; command: CompanionCommand }
  | { kind: 'clarify'; reply: string }
  | { kind: 'reject'; reply: string }

export type CommandSubmissionResult = {
  kind: CommandDecision['kind'] | 'empty' | 'screen-confirmation' | 'error'
  message: string
}
