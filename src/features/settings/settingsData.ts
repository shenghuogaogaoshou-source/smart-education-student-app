import { Bot, Camera, CircleHelp, Database, Eye, FileText, LockKeyhole, MessageSquare, Mic, MonitorCog, ShieldCheck, Smartphone, Sparkles, UsersRound, Volume2 } from 'lucide-react'

export type SettingItem = { id: string; label: string; status: string; Icon: typeof Bot }
export type SettingGroup = { id: string; title: string; items: SettingItem[] }

export const settingGroups: SettingGroup[] = [
  { id: 'account', title: '账号与学段', items: [
    { id: 'security', label: '账号与安全', status: '密码与设备', Icon: LockKeyhole },
    { id: 'guardian', label: '监护与家庭', status: '查看授权', Icon: UsersRound },
    { id: 'stage', label: '学段与年级', status: '当前学习端', Icon: Smartphone },
  ] },
  { id: 'ai', title: 'AI 伙伴', items: [
    { id: 'companion', label: '伙伴与互动', status: '位置、形象与回应', Icon: Bot },
    { id: 'voice', label: '语音与应用控制', status: '按需开启', Icon: Mic },
    { id: 'memory', label: '对话记录与长期记忆', status: '本地演示', Icon: MessageSquare },
    { id: 'operation', label: '操作确认与安全', status: '分级保护', Icon: ShieldCheck },
  ] },
  { id: 'experience', title: '学习与使用体验', items: [
    { id: 'font', label: '字体与显示', status: '标准', Icon: MonitorCog },
    { id: 'sound', label: '声音与触感', status: '声音开启', Icon: Volume2 },
    { id: 'notifications', label: '消息通知', status: '重要消息', Icon: Sparkles },
  ] },
  { id: 'privacy', title: '隐私与内容安全', items: [
    { id: 'privacy', label: '隐私设置', status: '管理可见范围', Icon: Eye },
    { id: 'permissions', label: '相机、麦克风与相册', status: '权限管理', Icon: Camera },
    { id: 'content', label: '个性化与内容保护', status: '年龄适配中', Icon: ShieldCheck },
  ] },
  { id: 'general', title: '通用与支持', items: [
    { id: 'storage', label: '下载与存储', status: '本地演示数据', Icon: Database },
    { id: 'help', label: '帮助与意见反馈', status: '获取帮助', Icon: CircleHelp },
    { id: 'about', label: '关于与规则', status: '版本信息', Icon: FileText },
  ] },
]
