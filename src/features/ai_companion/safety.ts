export type DemoCommandRisk = 'unclear' | 'safe' | 'medium' | 'high' | 'blocked'

export function classifyDemoCommand(text: string): DemoCommandRisk {
  const normalized = text.trim().toLowerCase()
  if (!normalized || /那个|弄一下|随便|你知道的|帮帮我$/.test(normalized)) return 'unclear'
  if (/蠢|笨蛋|垃圾|滚|色情|裸照|武器|自杀/.test(normalized)) return 'blocked'
  if (/密码|注销|删除账号|清空所有|监护人|安全设置/.test(normalized)) return 'high'
  if (/改.*安排|安排.*改|调整.*时间|发布|公开|改.*年级|更换学段/.test(normalized)) return 'medium'
  return 'safe'
}
