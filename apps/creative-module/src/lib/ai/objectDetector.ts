// ============================================================
// 真实 AI 引擎 —— 目标检测（COCO-SSD）
// TensorFlow.js + COCO-SSD (lite_mobilenet_v2)：检测 80 类常见物体
// 输出：[{ bbox: [x,y,w,h], class: 'person', score: 0.92 }, ...]
//
// 加载策略（按顺序探测，首个可达即用）：
//   1. VITE_COCO_SSD_MODEL_URL  用户自定义源（.env）
//   2. /models/coco-ssd/model.json  本地打包（运行 scripts/fetch-coco-ssd.ps1 后存在）
//   3. https://storage.googleapis.com/...  官方 GCS（需可访问）
// 这样：在国内受限网络下运行过一次 fetch 脚本即可永久离线可用；
//      在可访问 GCS 的网络下直接走官方源。
// ============================================================
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

export type DetectorEngine = 'coco-ssd' | 'none'

/** 单次模型加载的看门狗上限：下载"卡住但既不成功也不报错"时不能无限等下去 */
const MODEL_LOAD_TIMEOUT_MS = 45000

/** 官方 GCS 模型地址（lite_mobilenet_v2 体积小、速度快） */
const GCS_URL =
  'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json'
/** 本地打包地址（运行 fetch 脚本后存在；相对地址兼容 APK iframe 子路径） */
const LOCAL_URL = new URL('models/coco-ssd/model.json', document.baseURI).href

let engine: DetectorEngine = 'none'
let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null

async function ensureBackend() {
  // WebGL 推理快；不可用则回退 CPU
  try {
    await tf.setBackend('webgl')
  } catch {
    await tf.setBackend('cpu')
  }
  await tf.ready()
}

/** 带超时的 fetch（用于探测候选源是否可达） */
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { method: 'GET', signal: ctrl.signal, mode: 'cors' }).finally(() =>
    clearTimeout(timer),
  )
}

/**
 * 给加载流程套一个有上限的超时看门狗
 * 卡住（既不成功也不失败）的下载会让 initDetector() 永远 pending，
 * UI 一直停在「加载 COCO-SSD…」且没有重试入口；超时后抛出中文错误，
 * initDetector 的 catch 会把 modelPromise 复位，下一次调用仍可重新尝试。
 */
function withLoadTimeout<T>(task: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `COCO-SSD ${label}超时（${MODEL_LOAD_TIMEOUT_MS / 1000} 秒）：下载似乎卡住了，请检查网络后重试。`,
        ),
      )
    }, MODEL_LOAD_TIMEOUT_MS)
    task.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * 按优先级探测候选模型地址，返回第一个能成功取到 model.json 的地址。
 * GCS 等慢源用较短超时快速跳过，避免长时间卡顿。
 */
async function resolveModelUrl(): Promise<string> {
  const envUrl = import.meta.env.VITE_COCO_SSD_MODEL_URL as string | undefined
  const candidates: { url: string; timeout: number; label: string }[] = [
    ...(envUrl ? [{ url: envUrl, timeout: 15000, label: '自定义源' }] : []),
    { url: LOCAL_URL, timeout: 4000, label: '本地打包' },
    { url: GCS_URL, timeout: 10000, label: '官方 GCS' },
  ]

  const errors: string[] = []
  for (const c of candidates) {
    try {
      const res = await fetchWithTimeout(c.url, c.timeout)
      if (res.ok) {
        const ct = res.headers.get('content-type') || ''
        // 本地打包/GCS 都应返回 json；某些 CDN 可能无 ct，放行 ok 即可
        if (ct.includes('json') || ct.includes('octet-stream') || ct === '') {
          return c.url
        }
        errors.push(`${c.label}: 内容类型异常 (${ct})`)
      } else {
        errors.push(`${c.label}: HTTP ${res.status}`)
      }
    } catch (e) {
      errors.push(`${c.label}: ${(e as Error).message}`)
    }
  }
  throw new Error(
    '所有模型源均不可达：' +
      errors.join('；') +
      '。可在 .env 设置 VITE_COCO_SSD_MODEL_URL，或运行 scripts/fetch-coco-ssd.ps1 将模型下载到本地 public/models/coco-ssd/。',
  )
}

/**
 * 预缓存模型权重分片（shard）
 * 解析 model.json 中的 weightsManifest.paths，并行 fetch 所有分片让浏览器缓存
 * 这样 cocoSsd.load 内部再 fetch 时直接命中缓存，避免并发请求被中止
 */
async function precacheShards(modelUrl: string) {
  try {
    const baseUrl = modelUrl.replace(/model\.json$/, '')
    const res = await fetch(modelUrl)
    const manifest = await res.json()
    const paths: string[] =
      manifest?.weightsManifest?.flatMap((g: { paths: string[] }) => g.paths) ?? []
    if (paths.length === 0) return
    // 必须把响应体读完（arrayBuffer）：fetch 只等响应头就 resolve，
    // 不消费 body 的话分片不会进入 HTTP 缓存，cocoSsd.load 时又要重新下一遍
    await Promise.all(
      paths.map(async (p) => {
        try {
          const shard = await fetch(baseUrl + p)
          if (!shard.ok) {
            console.warn(`[COCO-SSD] shard 预缓存跳过 ${p}：HTTP ${shard.status}`)
            return
          }
          await shard.arrayBuffer()
        } catch (e) {
          // 单个分片失败（含 404）不能中断整批，其余分片仍应进缓存
          console.warn(`[COCO-SSD] shard 预缓存失败 ${p}:`, (e as Error).message)
        }
      }),
    )
    console.log(`[COCO-SSD] shard 预缓存完成: ${paths.length} 个文件`)
  } catch (e) {
    console.warn('[COCO-SSD] shard 预缓存失败（忽略，cocoSsd.load 会自行处理）:', (e as Error).message)
  }
}

export interface Detection {
  bbox: [number, number, number, number] // x, y, w, h
  class: string // 中文标签
  score: number
}

// COCO-SSD 80 类英文 → 中文映射表
const COCO_CLASSES_ZH: Record<string, string> = {
  person: '人',
  bicycle: '自行车',
  car: '汽车',
  motorcycle: '摩托车',
  airplane: '飞机',
  bus: '公交车',
  train: '火车',
  truck: '卡车',
  boat: '船',
  'traffic light': '交通灯',
  'fire hydrant': '消火栓',
  'stop sign': '停止标志',
  'parking meter': '停车收费表',
  bench: '长椅',
  bird: '鸟',
  cat: '猫',
  dog: '狗',
  horse: '马',
  sheep: '羊',
  cow: '牛',
  elephant: '大象',
  bear: '熊',
  zebra: '斑马',
  giraffe: '长颈鹿',
  backpack: '背包',
  umbrella: '雨伞',
  handbag: '手提包',
  tie: '领带',
  suitcase: '行李箱',
  frisbee: '飞盘',
  skis: '滑雪板',
  snowboard: '单板滑雪',
  'sports ball': '运动球',
  kite: '风筝',
  'baseball bat': '棒球棒',
  'baseball glove': '棒球手套',
  skateboard: '滑板',
  surfboard: '冲浪板',
  'tennis racket': '网球拍',
  bottle: '瓶子',
  'wine glass': '酒杯',
  cup: '杯子',
  fork: '叉子',
  knife: '刀',
  spoon: '勺子',
  bowl: '碗',
  banana: '香蕉',
  apple: '苹果',
  sandwich: '三明治',
  orange: '橙子',
  broccoli: '西蓝花',
  carrot: '胡萝卜',
  'hot dog': '热狗',
  pizza: '披萨',
  donut: '甜甜圈',
  cake: '蛋糕',
  chair: '椅子',
  couch: '沙发',
  'potted plant': '盆栽',
  bed: '床',
  'dining table': '餐桌',
  toilet: '马桶',
  tv: '电视',
  laptop: '笔记本电脑',
  mouse: '鼠标',
  remote: '遥控器',
  keyboard: '键盘',
  'cell phone': '手机',
  microwave: '微波炉',
  oven: '烤箱',
  toaster: '烤面包机',
  sink: '水槽',
  refrigerator: '冰箱',
  book: '书',
  clock: '时钟',
  vase: '花瓶',
  scissors: '剪刀',
  'teddy bear': '泰迪熊',
  'hair drier': '吹风机',
  toothbrush: '牙刷',
}

/** 将 COCO 英文类别名翻译为中文（未知类别原样返回） */
function translateClass(en: string): string {
  return COCO_CLASSES_ZH[en] ?? en
}

/**
 * 初始化目标检测引擎
 * 加载 COCO-SSD（lite_mobilenet_v2），失败一次后重试一次
 */
export async function initDetector(): Promise<DetectorEngine> {
  if (engine === 'coco-ssd' && modelPromise) {
    await modelPromise
    return engine
  }
  await ensureBackend()

  const tryLoad = async (): Promise<cocoSsd.ObjectDetection> =>
    // 整个"探测源 → 预缓存分片 → 载入模型"流程都要有上限，否则卡住的下载会让重试入口永远出不来
    withLoadTimeout(
      (async () => {
        const modelUrl = await resolveModelUrl()
        // 预缓存 shard 文件：解析 model.json 获取权重分片路径，并行预加载
        // 避免 cocoSsd.load 内部并发 fetch 时部分请求被浏览器中止 (ERR_ABORTED)
        await precacheShards(modelUrl)
        return cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl })
      })(),
      '模型加载',
    )

  try {
    modelPromise = tryLoad()
    const model = await modelPromise
    // 预热：避免首帧推理卡顿
    // 用 canvas 而非 tf.zeros —— COCO-SSD 的 image_tensor 期望 int32，
    // detect 内部会通过 tf.browser.fromPixels 将 canvas 转为 int32，避免 dtype 不匹配
    const warmupCanvas = document.createElement('canvas')
    warmupCanvas.width = 224
    warmupCanvas.height = 224
    try {
      await model.detect(warmupCanvas, 1, 0.5)
    } catch (warmupErr) {
      // 预热失败不影响模型就绪（模型已加载成功，仅首帧可能稍慢）
      console.warn('[COCO-SSD] 预热失败（不影响使用）:', (warmupErr as Error).message)
    }
    engine = 'coco-ssd'
    return engine
  } catch (e) {
    // 重试一次（首次并发 fetch shard 可能被中止，重试时已缓存）
    try {
      modelPromise = tryLoad()
      const model = await modelPromise
      const warmupCanvas = document.createElement('canvas')
      warmupCanvas.width = 224
      warmupCanvas.height = 224
      try {
        await model.detect(warmupCanvas, 1, 0.5)
      } catch (warmupErr) {
        console.warn('[COCO-SSD] 重试预热失败（不影响使用）:', (warmupErr as Error).message)
      }
      engine = 'coco-ssd'
      return engine
    } catch (e2) {
      engine = 'none'
      modelPromise = null
      throw new Error(
        'COCO-SSD 模型加载失败：' +
          (e2 as Error).message +
          '。提示：运行 scripts/fetch-coco-ssd.ps1 把模型下载到本地，或在 .env 配置 VITE_COCO_SSD_MODEL_URL 指向可达镜像。',
      )
    }
  }
}

/**
 * 对一帧图像进行目标检测
 * @param source 画布/视频/图片
 * @param maxBoxes 最多返回多少个检测框
 * @param minScore 最低置信度阈值（0~1）
 */
export async function detect(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageData,
  maxBoxes = 10,
  minScore = 0.5,
): Promise<Detection[]> {
  if (engine !== 'coco-ssd' || !modelPromise) {
    throw new Error('检测引擎未就绪（模型未加载成功）')
  }
  const model = await modelPromise
  const raw = await model.detect(source, maxBoxes, minScore)
  return raw.map((d) => ({
    bbox: d.bbox as [number, number, number, number],
    class: translateClass(d.class),
    score: d.score,
  }))
}
