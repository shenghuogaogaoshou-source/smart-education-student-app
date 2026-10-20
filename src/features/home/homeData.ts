import { Camera, FileScan, Languages, ScanLine, SearchCheck, Sparkles } from 'lucide-react'

// 首页「AI 通识新鲜报」轮播：每条资讯配一张绘本背景图和一层渐变遮罩。
// 遮罩只压暗背景，文字层始终在遮罩之上，不使用 filter 以免把标题一起变灰。
export type HomeNewsItem = {
  id: string
  title: string
  cover: string
  gradient: string
}

export const homeCopy = {
  greeting: '你好，小小探索家',
  subline: '今天想和 AI 一起发现什么？',
  news: [
    {
      id: 'comic-1',
      title: 'AI 也要学会分清“像”和“一样”',
      cover: '/courses/qmx/bg-robot-classroom.jpg',
      gradient: 'linear-gradient(135deg, rgba(40, 35, 55, 0.75) 0%, rgba(80, 60, 100, 0.65) 50%, rgba(120, 80, 140, 0.55) 100%)',
    },
    {
      id: 'comic-2',
      title: '机器人怎样听懂不同的说话声音',
      cover: '/courses/qmx/bg-girl-laptop.jpg',
      gradient: 'linear-gradient(135deg, rgba(60, 40, 80, 0.75) 0%, rgba(100, 70, 120, 0.65) 50%, rgba(140, 100, 160, 0.55) 100%)',
    },
    {
      id: 'comic-3',
      title: 'AI 还在保护环境？小学生也能参与！',
      cover: '/courses/qmx/bg-robot-earth.jpg',
      gradient: 'linear-gradient(135deg, rgba(50, 60, 80, 0.75) 0%, rgba(80, 100, 140, 0.65) 50%, rgba(110, 140, 180, 0.55) 100%)',
    },
    {
      id: 'comic-4',
      title: '让电脑看图时，为什么要多看几个例子',
      cover: '/courses/qmx/bg-robot-kid.jpg',
      gradient: 'linear-gradient(135deg, rgba(80, 50, 60, 0.75) 0%, rgba(120, 80, 100, 0.65) 50%, rgba(160, 110, 140, 0.55) 100%)',
    },
  ] satisfies HomeNewsItem[],
}

export const games = [
  { id: 'game-vision', title: '图像侦探', note: '观察机器怎样找线索', icon: 'vision' },
  { id: 'game-prompt', title: '提示词工坊', note: '把想法说得更清楚', icon: 'prompt' },
  { id: 'game-sort', title: '分类挑战', note: '帮 AI 整理新发现', icon: 'sort' },
  { id: 'game-bot', title: '机器判断局', note: '找出答案中的疑点', icon: 'bot' },
  { id: 'game-create', title: '创意拼搭站', note: '组合灵感做作品', icon: 'create' },
]

export const cameraTools = [
  { title: '拍照识物', Icon: Camera },
  { title: '扫码识别', Icon: ScanLine },
  { title: '文字提取', Icon: FileScan },
  { title: '题目解析', Icon: Sparkles },
  { title: '翻译文字', Icon: Languages },
  { title: '内容检查', Icon: SearchCheck },
]

export const worksByPeriod = {
  day: [
    { id: 'work-camera', title: '会分类的照相机', author: '星河同学', tag: '创意实验' },
    { id: 'work-library', title: '未来图书馆', author: '小羽同学', tag: '空间设计' },
  ],
  week: [
    { id: 'work-campus', title: '未来校园小设计', author: '林川同学', tag: '本周人气' },
    { id: 'work-voice', title: '声音地图', author: '清禾同学', tag: '科学表达' },
  ],
  year: [
    { id: 'work-ocean', title: 'AI 海洋观察站', author: '远帆同学', tag: '年度灵感' },
    { id: 'work-city', title: '会思考的绿色城市', author: '若安同学', tag: '实践创造' },
  ],
} as const
