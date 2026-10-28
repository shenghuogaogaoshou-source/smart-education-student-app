export type ToolId = 'object' | 'scan' | 'ocr' | 'solve' | 'translate' | 'check'
export type ToolResult = { scanContent?: string; sourceText?: string; title: string; output: string; evidence: string[]; steps: { title: string; detail: string }[]; uncertainty: string; introduction?: { overview: string; funFact: string; question: string } }
export const toolDetails: { id: ToolId; hint: string }[] = [
  { id: 'object', hint: '拍下身边的物品，认识它的特点，发现背后的科学知识。' },
  { id: 'scan', hint: '读出二维码或条码，再让 AI 帮你理解其中的内容。' },
  { id: 'ocr', hint: '拍清楚书页或便签，提取后再对照原图检查。' },
  { id: 'solve', hint: '输入或拍下题目，先理解条件，再学习解法。' },
  { id: 'translate', hint: '输入文字或上传图片，学习译文与关键词。' },
  { id: 'check', hint: '看看内容有没有说错、泄露个人信息，或让人不舒服的表达。' },
]

export type ImageReadOptions = {
  maxEdge?: number
  preserveOriginal?: boolean
}

export function imageMaxEdgeForTool(tool: ToolId): number {
  if (tool === 'object') return 960
  if (tool === 'ocr') return 1280
  if (tool === 'scan') return 1600
  return 1024
}

export async function readImage(file: File, options: ImageReadOptions | boolean = {}): Promise<string> {
  const settings = typeof options === 'boolean' ? { preserveOriginal: options } : options
  const preserveOriginal = settings.preserveOriginal ?? false
  const maxEdge = settings.maxEdge ?? 1600
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。')
  if (file.size > 20 * 1024 * 1024) throw new Error('图片太大，请选择 20 MB 以内的原图。')
  if (preserveOriginal) return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败，请重新上传。'))
    reader.readAsDataURL(file)
  })
  const bitmap = await createImageBitmap(file)
  try {
    const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器无法处理图片。')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', .88)
  } finally { bitmap.close() }
}

export async function scanImage(image: string): Promise<ToolResult> {
  type Detector = { detect: (source: ImageBitmap) => Promise<{ rawValue: string; format: string }[]> }
  const BrowserDetector = (window as unknown as { BarcodeDetector?: new () => Detector }).BarcodeDetector
  const bitmap = await createImageBitmap(await (await fetch(image)).blob())
  try {
    let codes: { rawValue: string; format: string }[] = []
    if (BrowserDetector) {
      try { codes = await new BrowserDetector().detect(bitmap) } catch { /* Use the compatible decoder below. */ }
    }
    if (!codes.length) {
      const { decodeBitmap } = await import('./barcodeDecoder')
      const decoded = decodeBitmap(bitmap)
      if (decoded) codes = [decoded]
    }
    if (!codes.length) throw new Error('暂时没读出码中的内容。拍摄屏幕时，请正对码面、避开反光并保留四周空白；也可以直接上传二维码原图。')
    return { title: `读到 ${codes.length} 个码`, output: codes.map(c => c.rawValue).join('\n\n'), evidence: codes.map(c => `识别格式：${c.format}`), steps: [{ title: '读取码面', detail: '浏览器在本机解码图片，没有上传到 AI 服务。' }, { title: '展示原始内容', detail: '保留编码中的文本，不执行指令，也不自动跳转。' }], uncertainty: '扫码结果不代表内容可信。陌生网址和付款码请先让家长或老师确认。' }
  } finally { bitmap.close() }
}
