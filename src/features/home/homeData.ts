import { Camera, FileScan, Languages, ScanLine, SearchCheck, Sparkles } from 'lucide-react'
import type { LearningStage } from '../../app/model'

export const stageCopy: Record<LearningStage, { greeting: string; subline: string; news: string[] }> = {
  elementary: {
    greeting: '你好，小小探索家',
    subline: '今天想和 AI 一起发现什么？',
    news: ['AI 也要学会分清“像”和“一样”', '机器人怎样听懂不同的说话声音', '让电脑看图时，为什么要多看几个例子'],
  },
  secondary: {
    greeting: '你好，未来探索者',
    subline: '从一个好问题开始今天的学习。',
    news: ['多模态模型如何同时处理文字、图像与声音', '训练数据质量为什么会影响模型判断', '生成式 AI 的回答应怎样进行来源核验'],
  },
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
