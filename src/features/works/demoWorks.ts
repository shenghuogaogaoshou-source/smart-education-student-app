import type { WorkRecord, PreviewKind, WorkRepository, WorkSource } from './types'

export type DemoWorkSpec = {
  id: string
  title: string
  description: string
  source: Exclude<WorkSource, 'external-upload'>
  previewKind: Extract<PreviewKind, 'image' | 'video'>
  assetPath: string
  posterPath?: string
  creatorId: string
  creatorName: string
  publishedOffsetMs: number
  aiTools: string[]
}

const videoTitles = [
  ['clockwork-morning', '会呼吸的时钟', '老时钟在晨光里轻轻转动，时间也有了自己的故事。'],
  ['mushroom-home', '森林里的蘑菇小屋', '如果蘑菇能变成家，门后会住着怎样的新朋友？'],
  ['rabbit-nap', '小兔的阳光午睡', '一束暖光落进房间，小兔做了一个甜甜的梦。'],
  ['sunset-smile', '落日里的微笑', '把黄昏最温柔的一刻，留在会动的画面里。'],
  ['cliff-and-sea', '悬崖边的橙色海', '站得高一点，原来城市和大海能同时装进眼睛。'],
  ['forest-craft', '森林手作课', '小兔认真制作木头字母，把想法一点点变成作品。'],
  ['carrot-friends', '胡萝卜交换会', '两位森林朋友用一根胡萝卜交换快乐和信任。'],
  ['rabbit-town', '背包小兔进城记', '第一次走进热闹小镇，每一步都是新的发现。'],
] as const

const imageTitles = [
  ['cloud-seed', '银发小小探索家', '把喜欢的颜色和衣服画进像素世界，做出自己的冒险角色。'],
  ['star-letter', '樱花下的小仓鼠', '春日的花瓣轻轻落下，小仓鼠也收到了温柔的问候。'],
  ['dream-library', '草地上的卷毛小羊', '清晨的露珠闪着光，小羊在草地上发现了新朋友。'],
  ['tiny-planet', '溪边的小黄鸭', '暖暖的阳光落在溪水上，小黄鸭开始了今天的散步。'],
  ['rainbow-workshop', '晨光中的小狐狸', '森林刚刚醒来，小狐狸正等着一场有趣的探险。'],
  ['moon-garden', '溪边的小海豹', '圆滚滚的小海豹趴在溪边，认真听着流水的声音。'],
  ['future-classroom', '森林里的柴犬朋友', '一只精神的小柴犬站在林间，准备和伙伴一起出发。'],
  ['ocean-postcard', '花朵魔法棒', '旧木桌上的花朵魔法棒，藏着一段等待被发现的故事。'],
  ['paper-city', '阳光里的旧唱片机', '唱片机在午后的阳光里转动，把房间装满轻柔的音乐。'],
  ['forest-concert', '松果守护者', '小松鼠守着珍贵的松果，也守着属于森林的小秘密。'],
  ['space-train', '森林里的小熊猫', '软乎乎的小熊猫坐在草地上，邀请你一起观察自然。'],
  ['light-house', '向着落日出发', '站在云海之上张开双臂，把勇气留在金色的夕阳里。'],
  ['seed-robot', '孤独患者', '用影像、文字与光影完成的一张情绪主题创意海报。'],
  ['flying-island', '云上未来城', '高塔与云海交织在一起，想象未来城市会怎样生活。'],
  ['color-lab', '月光森林的远方', '穿过森林望向巨大的月亮，远方像一幅会发光的画。'],
  ['rainy-friend', '金色宫殿之门', '倒影、拱门和晚霞连在一起，通向一座幻想中的宫殿。'],
  ['time-bottle', '夜晚的温暖相遇', '在安静的夜晚，两位小伙伴用陪伴点亮彼此的心情。'],
] as const

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const publishedOffsets = [
  2 * HOUR,
  7 * HOUR,
  14 * HOUR,
  23 * HOUR,
  2 * DAY,
  4 * DAY,
  6 * DAY,
  10 * DAY,
  12 * DAY,
  16 * DAY,
  22 * DAY,
  30 * DAY,
  42 * DAY,
  58 * DAY,
  75 * DAY,
  95 * DAY,
  120 * DAY,
  150 * DAY,
  180 * DAY,
  210 * DAY,
  240 * DAY,
  270 * DAY,
  300 * DAY,
  330 * DAY,
  360 * DAY,
] as const

const virtualAuthors = [
  { id: 'virtual-author-lele', name: '乐乐' },
  { id: 'virtual-author-xinghe', name: '星禾' },
  { id: 'virtual-author-mili', name: '米粒' },
  { id: 'virtual-author-xiaoyu', name: '小宇' },
  { id: 'virtual-author-duoduo', name: '朵朵' },
  { id: 'virtual-author-anan', name: '安安' },
] as const

const currentAccountCreator = {
  id: 'current-account',
  name: '晨曦同学',
} as const

const videoWorks: DemoWorkSpec[] = videoTitles.map(([slug, title, description], index) => ({
  id: `demo-video-${index + 1}`,
  title,
  description,
  source: index % 2 === 0 ? 'brain-film' : 'creative-module',
  previewKind: 'video',
  assetPath: `/demo-works/videos/${slug}.mp4`,
  posterPath: `/demo-works/posters/${slug}.jpg`,
  creatorId: currentAccountCreator.id,
  creatorName: currentAccountCreator.name,
  publishedOffsetMs: publishedOffsets[index],
  aiTools: ['智芽创意助手'],
}))

const imageWorks: DemoWorkSpec[] = imageTitles.map(([slug, title, description], index) => {
  const creator = virtualAuthors[index % virtualAuthors.length]
  return {
    id: `demo-image-${index + 1}`,
    title,
    description,
    source: index % 2 === 0 ? 'creative-module' : 'brain-film',
    previewKind: 'image',
    assetPath: `/demo-works/images/${slug}.webp`,
    creatorId: creator.id,
    creatorName: creator.name,
    publishedOffsetMs: publishedOffsets[videoTitles.length + index],
    aiTools: ['智芽创意助手'],
  }
})

export const DEMO_WORK_SPECS: DemoWorkSpec[] = [...videoWorks, ...imageWorks]

export function getDemoWorkSpec(sourceDraftId?: string) {
  return sourceDraftId
    ? DEMO_WORK_SPECS.find((work) => work.id === sourceDraftId)
    : undefined
}

export const DEFAULT_DEMO_WORK_ACCOUNT = '123'

export type DemoAssetLoader = (assetPath: string) => Promise<Blob>

async function createDemoAssetPlaceholder(assetPath: string) {
  return new Blob([assetPath], {
    type: assetPath.endsWith('.mp4') ? 'video/mp4' : 'image/webp',
  })
}

export async function seedDemoWorks(
  repository: WorkRepository,
  accountId: string,
  loadAsset: DemoAssetLoader = createDemoAssetPlaceholder,
  initializedAt = new Date(),
) {
  const existing = await repository.list(accountId)
  const currentDemoIds = new Set(DEMO_WORK_SPECS.map((work) => work.id))
  const obsoleteDemoWorks = existing.filter((work) => (
    work.sourceDraftId?.startsWith('demo-')
    && !currentDemoIds.has(work.sourceDraftId)
  ))
  await Promise.all(obsoleteDemoWorks.map((work) => repository.delete(accountId, work.id)))

  const existingBySourceDraft = new Map(
    existing
      .filter((work) => work.sourceDraftId)
      .map((work) => [work.sourceDraftId!, work]),
  )

  for (const [index, spec] of DEMO_WORK_SPECS.entries()) {
    const creatorId = spec.creatorId === currentAccountCreator.id
      ? accountId
      : spec.creatorId
    const desiredPublishedAt = new Date(
      initializedAt.getTime() - spec.publishedOffsetMs,
    ).toISOString()
    let record = existingBySourceDraft.get(spec.id)
    const needsMigration = !record
      || record.status !== 'published'
      || !record.publishedAt
      || !record.creatorId
      || !record.creatorName

    if (!record) {
      const blob = await loadAsset(spec.assetPath)
      record = await repository.saveDraft(accountId, {
        source: spec.source,
        sourceDraftId: spec.id,
        creatorId,
        creatorName: spec.creatorName,
        title: spec.title,
        description: spec.description,
        aiTools: spec.aiTools,
        fileName: spec.assetPath.split('/').at(-1) ?? `${spec.id}.${spec.previewKind === 'video' ? 'mp4' : 'png'}`,
        blob,
      })
    }

    if (!needsMigration) continue

    const published = await repository.setStatus(accountId, record.id, 'published')
    await repository.update(accountId, published.id, {
      creatorId,
      creatorName: spec.creatorName,
      publishedAt: desiredPublishedAt,
      likes: 18 + (index * 7) % 83,
      favorites: 6 + (index * 5) % 37,
    })
  }

  return repository.list(accountId)
}

export function isContinuableGameDraft(work: WorkRecord) {
  return work.status === 'draft'
    && (work.source === 'brain-film' || work.source === 'creative-module')
}
