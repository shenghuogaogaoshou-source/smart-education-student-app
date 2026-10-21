// ============================================================
// AI 模块市场 —— 所有可拖入画布的 AI 元件
// 核心可用：Camera / ImageClassifier / If / Output
// 生态预览：展示"开放架构"愿景（标记 preview，不可拖入）
// ============================================================
import type { AIModule, ModuleCategory } from '../types/circuit'

// -------------------- 核心：可运行的最小链路 --------------------

const camera: AIModule = {
  type: 'camera',
  name: 'Camera',
  subtitle: '摄像头',
  category: 'input',
  icon: 'Camera',
  accent: '#6ba3c3',
  description: '捕获摄像头画面，持续输出图像帧。',
  inputs: [],
  outputs: [{ id: 'image', label: '图像', type: 'image' }],
  params: [
    {
      id: 'fps',
      label: '采样频率 (帧/秒)',
      type: 'number',
      default: 2,
      min: 1,
      max: 10,
      step: 1,
      editable: true,
    },
  ],
  explanation:
    '摄像头是整个 AI 系统的"眼睛"。它把真实世界变成一帧帧图像数据，喂给后面的 AI 模型。没有输入，AI 就没有东西可以判断。',
  code: () => `# 捕获一帧摄像头画面
image = camera.capture()
# image 现在是一张可以送进 AI 的图像数据`,
}

const imageClassifier: AIModule = {
  type: 'imageClassifier',
  name: '感光器',
  subtitle: 'Photosensor · 亮度感知',
  category: 'perception',
  icon: 'Sun',
  accent: '#d4a04a',
  description: '读取画面的平均亮度，判断明暗。像生物的感光细胞。',
  inputs: [{ id: 'image', label: '图像', type: 'image' }],
  outputs: [
    { id: 'label', label: '标签', type: 'label' },
    { id: 'confidence', label: '亮度值', type: 'confidence' },
  ],
  params: [
    {
      id: 'threshold',
      label: '亮/暗阈值（0~100%）',
      type: 'number',
      default: 50,
      min: 0,
      max: 100,
      step: 5,
      editable: true,
    },
    {
      id: 'sensitivity',
      label: '灵敏度',
      type: 'select',
      default: 'normal',
      options: [
        { label: '轻柔', value: 'soft' },
        { label: '正常', value: 'normal' },
        { label: '敏感', value: 'high' },
      ],
      editable: true,
    },
  ],
  model: 'Pixel Luminance',
  explanation:
    '感光器不"识别"画面里有什么，它只做一件事：统计画面里每个像素的亮度，算出一个0~100%的平均值。就像眼睛里的感光细胞——它不关心"是猫还是狗"，只关心"亮还是暗"。用阈值把它分成亮/暗两档，就能做"天黑开灯"、"关灯报警"这样的简单逻辑。',
  code: (p) => `# 感光器：把图像转成亮度值（0~100%）
pixels = image.read_pixels()
brightness = luminance.mean(pixels)  # 平均亮度

# 灵敏度曲线
if sensitivity == "soft":
    brightness = brightness ** 1.4
elif sensitivity == "high":
    brightness = brightness ** 0.7

# 阈值分段：亮/暗
if brightness >= ${p.threshold}:
    label = "亮"
else:
    label = "暗"
`,
}

// -------------------- 目标检测：真实 COCO-SSD --------------------

const objectDetection: AIModule = {
  type: 'objectDetection',
  name: '目标检测',
  subtitle: 'Object Detection · COCO-SSD',
  category: 'perception',
  icon: 'ScanSearch',
  accent: '#d4a04a',
  description: '真实 COCO-SSD 模型，检测图像中的物体并输出标签。',
  inputs: [{ id: 'image', label: '图像', type: 'image' }],
  outputs: [
    { id: 'label', label: '标签', type: 'label' },
    { id: 'count', label: '数量', type: 'number' },
  ],
  params: [
    {
      id: 'maxBoxes',
      label: '最多检测框数',
      type: 'number',
      default: 5,
      min: 1,
      max: 20,
      step: 1,
      editable: true,
    },
    {
      id: 'minScore',
      label: '最低置信度（%）',
      type: 'number',
      default: 50,
      min: 10,
      max: 95,
      step: 5,
      editable: true,
    },
  ],
  model: 'COCO-SSD (TensorFlow.js)',
  explanation:
    '目标检测回答两个问题："是什么"和"在哪里"。COCO-SSD 能识别 80 种常见物体（人、猫、车、杯子…），它不仅给出类别标签，还标出物体在画面中的位置框。比感光器更进一步——感光器只看亮度，目标检测能"认出"具体物体。',
  code: (p) => `# 加载真实的 COCO-SSD 模型
model = coco_ssd.load(base="lite_mobilenet_v2")

# 检测图像中的物体
detections = model.detect(image, max_boxes=${p.maxBoxes}, min_score=${Number(p.minScore) / 100})

# detections = [
#   { class: "person", score: 0.92, bbox: [x, y, w, h] },
#   { class: "cat",    score: 0.78, bbox: [x, y, w, h] },
#   ...
# ]
label = detections[0].class   # 第一个检测到的物体
count = len(detections)        # 检测到几个物体`,
}

const ifNode: AIModule = {
  type: 'if',
  name: 'IF',
  subtitle: '条件判断',
  category: 'logic',
  icon: 'GitBranch',
  accent: '#8aab6e',
  description: '当输入标签与目标标签一致（或包含目标文本）时，输出真信号。',
  inputs: [{ id: 'label', label: '标签', type: 'label' }],
  outputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  params: [
    {
      id: 'targetLabel',
      label: '当标签包含',
      type: 'string',
      default: '',
      editable: true,
    },
  ],
  explanation:
    'IF 是把"AI 的判断"变成"真实行动"的开关：AI 输出文字标签，IF 只挑出我们关心的那一个。只要标签里出现了目标文字（比如"垃圾"、"亮"、"person"），IF 就会输出真信号，驱动后续机械臂、灯泡等装置开始工作。注意：目标标签要和 AI 实际输出的标签一致——感光器输出"亮"/"暗"，目标检测输出英文物体名（如 person、cat）。',
  code: (p) => `# 只看标签：匹配就行动，不匹配就不行动
if "${p.targetLabel}" in label:
    signal = True      # 触发行动
else:
    signal = False     # 不触发`,
}

const output: AIModule = {
  type: 'output',
  name: 'Lightbulb',
  subtitle: '灯泡输出',
  category: 'output',
  icon: 'Lightbulb',
  accent: '#d4825a',
  description: '收到真信号时点亮灯泡（开 / 关）。',
  inputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  outputs: [],
  params: [
    {
      id: 'action',
      label: '执行动作',
      type: 'select',
      default: 'light',
      options: [
        { label: '🚪 自动门', value: 'door' },
        { label: '💡 信号灯', value: 'light' },
        { label: '🔊 警报声', value: 'alarm' },
        { label: '🤖 机器人挥手', value: 'wave' },
      ],
      editable: true,
    },
  ],
  explanation:
    '一个 AI 系统不能只"回答"，必须会"做事"。输出模块把 AI 的判断变成真实的行动——这才是一个完整闭环：看见 → 判断 → 行动。',
  code: (p) => `# 收到真信号，执行真实动作
if signal == True:
    action.do("${p.action}")
else:
    action.stop("${p.action}")`,
}

// -------------------- 输入扩展：麦克风 / 文本 / 图片 --------------------

const microphone: AIModule = {
  type: 'microphone',
  name: '麦克风',
  subtitle: 'Microphone',
  category: 'input',
  icon: 'Mic',
  accent: '#3B82F6',
  description: '采集环境音频，为语音识别、音量检测等模块提供实时音频流。',
  inputs: [],
  outputs: [{ id: 'audio', label: '音频', type: 'audio' }],
  params: [
    {
      id: 'sampleRate',
      label: '采样率',
      type: 'select',
      default: '16000',
      options: [
        { label: '8 kHz (电话音质)', value: '8000' },
        { label: '16 kHz (语音识别)', value: '16000' },
        { label: '44.1 kHz (CD音质)', value: '44100' },
      ],
      editable: true,
    },
    {
      id: 'sensitivity',
      label: '灵敏度（0~100%）',
      type: 'number',
      default: 60,
      min: 0,
      max: 100,
      step: 5,
      editable: true,
    },
    {
      id: 'noiseSuppress',
      label: '噪声抑制',
      type: 'select',
      default: 'on',
      options: [
        { label: '开启', value: 'on' },
        { label: '关闭', value: 'off' },
      ],
      editable: true,
    },
  ],
  explanation:
    '麦克风是 AI 的"耳朵"，音频链路的起点（等同于摄像头之于图像分类）。' +
    '它把空气里的声波变成实时数字音频流，供语音识别、声音分类、音量检测等模块消费。' +
    '16kHz 是语音识别的常用采样率；44.1kHz 适合音乐分析；8kHz 最省带宽。',
  code: (p) => `# 打开麦克风并配置参数
stream = microphone.open(
    sample_rate=${p.sampleRate},
    sensitivity=${p.sensitivity}/100,
    noise_suppress=${p.noiseSuppress === 'on'}
)
# stream 是持续的 PCM 音频流
# 送进语音识别、声音分类、音量检测等模块`,
}

const textInput: AIModule = {
  type: 'textInput',
  name: '文本输入',
  subtitle: 'Text Input · 键盘',
  category: 'input',
  icon: 'Keyboard',
  accent: '#94A3B8',
  description: '手动输入或预设文本，支持自动输出、按钮发送、外部信号触发。',
  inputs: [],
  outputs: [{ id: 'text', label: '文本', type: 'text' }],
  params: [
    {
      id: 'text',
      label: '预设文本',
      type: 'string',
      default: '你好，世界',
      editable: true,
    },
    {
      id: 'trigger',
      label: '触发方式',
      type: 'select',
      default: 'auto',
      options: [
        { label: '自动输出（运行即发）', value: 'auto' },
        { label: '手动按钮', value: 'button' },
        { label: '外部信号触发', value: 'signal' },
      ],
      editable: true,
    },
  ],
  explanation:
    '不是所有 AI 都靠摄像头。翻译、问答、语音助手等大量 AI 能力都以文字为输入。' +
    '预设一段文字（如"现在是几点"），即可作为 LLM 的问题、TTS 的朗读内容、或调试用的常量文本。' +
    '支持三种触发模式：自动（运行时立刻发出）、按钮（点一下发一次）、信号触发（接外部信号才发）。',
  code: (p) => `# 文本输入模块
text = "${p.text}"

# 根据触发方式选择输出时机
if trigger == "auto":
    emit(text)                 # 运行即输出
elif trigger == "button":
    emit(text) when clicked    # 点按钮才输出
elif trigger == "signal":
    emit(text) when signal_in  # 外部信号才输出`,
}

const imageInput: AIModule = {
  type: 'imageInput',
  name: 'Image',
  subtitle: '图片输入',
  category: 'input',
  icon: 'Image',
  accent: '#6ba3c3',
  description: '上传或选择一张图片，输出图像帧。',
  inputs: [],
  outputs: [{ id: 'image', label: '图像', type: 'image' }],
  params: [],
  explanation:
    '除了实时摄像头，AI 也可以分析静态图片。图片输入模块让你上传任意一张图——它会被画到画布上，变成和摄像头一样的"图像数据"，送进后面的 AI 模型。',
  code: () => `# 加载一张图片到画布
image = imageInput.load()
# image 现在是一张可送进 AI 的图像数据`,
}

// -------------------- 逻辑扩展：AND / OR / NOT / Timer --------------------

const andNode: AIModule = {
  type: 'and',
  name: 'AND',
  subtitle: '且（全部成立）',
  category: 'logic',
  icon: 'Combine',
  accent: '#8aab6e',
  description: '当所有输入信号都为真时，输出真信号。',
  inputs: [
    { id: 'a', label: '信号 A', type: 'signal' },
    { id: 'b', label: '信号 B', type: 'signal' },
  ],
  outputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  params: [],
  explanation:
    'AND 要求所有条件"同时"成立。比如"有人 AND 是白天"才开灯。它教会学生：现实世界的决策往往是多个条件的组合，而不是单一判断。',
  code: () => `# 两个信号必须都为真
if signal_a and signal_b:
    out = True
else:
    out = False`,
}

const orNode: AIModule = {
  type: 'or',
  name: 'OR',
  subtitle: '或（任一成立）',
  category: 'logic',
  icon: 'Merge',
  accent: '#8aab6e',
  description: '当任一输入信号为真时，输出真信号。',
  inputs: [
    { id: 'a', label: '信号 A', type: 'signal' },
    { id: 'b', label: '信号 B', type: 'signal' },
  ],
  outputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  params: [],
  explanation:
    'OR 只要有一个条件成立就行动。比如"检测到烟雾 OR 检测到高温"就报警。它让系统更灵敏——但也可能更易误触发，需要权衡。',
  code: () => `# 任一信号为真即触发
if signal_a or signal_b:
    out = True
else:
    out = False`,
}

const notNode: AIModule = {
  type: 'not',
  name: 'NOT',
  subtitle: '非（取反）',
  category: 'logic',
  icon: 'CircleSlash',
  accent: '#8aab6e',
  description: '把输入信号取反：真变假，假变真。',
  inputs: [{ id: 'a', label: '信号', type: 'signal' }],
  outputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  params: [],
  explanation:
    'NOT 是逻辑取反。当 AI 说"不是猫"时，NOT 能把它变成"是猫"的信号。它常用于"反向触发"——比如"没有检测到人"时关灯。',
  code: () => `# 信号取反
out = not signal_a`,
}

const timerNode: AIModule = {
  type: 'timer',
  name: 'Timer',
  subtitle: '定时器',
  category: 'logic',
  icon: 'Timer',
  accent: '#8aab6e',
  description: '按设定间隔自动触发信号（无需输入）。',
  inputs: [],
  outputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  params: [
    {
      id: 'interval',
      label: '触发间隔（秒）',
      type: 'number',
      default: 2,
      min: 0.5,
      max: 10,
      step: 0.5,
      editable: true,
    },
  ],
  explanation:
    'Timer 让 AI 系统有了"时间感"。它不需要外部输入，按固定节奏发出信号——可用于定时采集、心跳检测、周期性任务。时间本身也是一种逻辑条件。',
  code: (p) => `# 每隔 ${p.interval} 秒触发一次
while running:
    sleep(${p.interval})
    signal = True  # 发出脉冲信号`,
}

// -------------------- 关卡专用模块 --------------------

const sceneCamera: AIModule = {
  type: 'sceneCamera',
  name: '场景相机',
  subtitle: 'Scene Camera',
  category: 'input',
  icon: 'Camera',
  accent: '#6ba3c3',
  description: '关卡场景专用相机，按设定频率捕获场景画面。',
  inputs: [],
  outputs: [{ id: 'image', label: '图像', type: 'image' }],
  params: [
    {
      id: 'fps',
      label: '采样频率（帧/秒）',
      type: 'number',
      default: 1,
      min: 0.2,
      max: 2,
      step: 0.1,
      editable: true,
    },
  ],
  levelOnly: true,
  explanation:
    '场景相机是机器人的"眼睛"。它每隔一段时间拍一张海面照片，送给后面的分类器判断。' +
    '采样频率越高反应越快，但计算量也越大。',
  code: (p) => {
    const fps = Number(p.fps)
    const interval = fps > 0 ? (1 / fps).toFixed(1) : '2.0'
    return `# 场景相机：每隔 ${interval} 秒拍一张照片
while running:
    image = scene.capture()
    emit(image)
    sleep(${interval})`
  },
}

const trashClassifier: AIModule = {
  type: 'trashClassifier',
  name: '垃圾分类器',
  subtitle: 'Trash Classifier · COCO-SSD',
  category: 'perception',
  icon: 'Recycle',
  accent: '#d4a04a',
  description: '用 COCO-SSD 目标检测模型分析画面：检测到瓶子/杯子等垃圾时输出「垃圾」标签，否则输出「鱼」标签。',
  inputs: [{ id: 'image', label: '图像', type: 'image' }],
  outputs: [{ id: 'label', label: '标签', type: 'label' }],
  params: [
    {
      id: 'minScore',
      label: '检测灵敏度（%阈值）',
      type: 'number',
      default: 30,
      min: 10,
      max: 80,
      step: 5,
      editable: true,
    },
  ],
  model: 'COCO-SSD',
  levelOnly: true,
  explanation:
    '这个分类器用真实的 COCO-SSD 目标检测模型"看"画面。' +
    '模型能识别 80 种常见物体，其中瓶子(bottle)、杯子(cup)、酒杯(wine glass)等属于垃圾。' +
    '当画面中检测到这些垃圾物体时，输出「垃圾」标签；否则认为画面里是鱼，输出「鱼」标签。' +
    '输出的标签可以送给 IF 节点做条件判断。' +
    '检测灵敏度越低，能发现越小的垃圾，但也可能误判。',
  code: (p) => `# 垃圾分类器：用 COCO-SSD 目标检测判断鱼/垃圾
detections = coco_ssd.detect(image, min_score=${Number(p.minScore) / 100})
trash_classes = ["bottle", "cup", "wine glass"]

if any(d.class in trash_classes for d in detections):
    label = "垃圾"     # 发现垃圾物体
else:
    label = "鱼"       # 没有垃圾，判为鱼`,
}

const roboticArm: AIModule = {
  type: 'roboticArm',
  name: '机械臂',
  subtitle: 'Robotic Arm',
  category: 'output',
  icon: 'Armchair', // 最近的"机械"图标
  accent: '#d4825a',
  description: '收到真信号时伸出抓取，收到假信号时不动（放行）。',
  inputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  outputs: [],
  params: [],
  levelOnly: true,
  explanation:
    '机械臂是机器人的"手"。它不自己思考，完全听从 AI 的命令：' +
    '收到真信号就抓，收到假信号就放过。它把数字世界的判断变成了真实的物理动作。',
  code: () => `# 机械臂：听从 AI 的信号
if signal == True:
    arm.grab()    # 抓取
else:
    arm.release() # 放行`,
}

// -------------------- 语音识别：Web Speech API 转文字 --------------------
const speechRecognition: AIModule = {
  type: 'speechRecognition',
  name: '语音识别',
  subtitle: 'Speech Recognition',
  category: 'perception',
  icon: 'Mic2',
  accent: '#3B82F6',
  description: '接收实时音频流，通过 Web Speech API 转为文本输出（中文/英文）。',
  inputs: [{ id: 'audio', label: '音频', type: 'audio' }],
  outputs: [{ id: 'text', label: '文本', type: 'text' }],
  params: [
    {
      id: 'language',
      label: '语言模式',
      type: 'select',
      default: 'zh',
      options: [
        { label: '中文（普通话）', value: 'zh' },
        { label: '英语（美式）', value: 'en' },
        { label: '自动检测', value: 'auto' },
      ],
      editable: true,
    },
    {
      id: 'mode',
      label: '识别模式',
      type: 'select',
      default: 'stream',
      options: [
        { label: '实时流式（连续识别）', value: 'stream' },
        { label: '整句识别（说完一次）', value: 'sentence' },
      ],
      editable: true,
    },
    {
      id: 'confidenceThreshold',
      label: '置信度阈值（0~1）',
      type: 'number',
      default: 0.7,
      min: 0.1,
      max: 1.0,
      step: 0.05,
      editable: true,
    },
  ],
  model: 'Web Speech API (浏览器内置)',
  explanation:
    '语音识别把人说的话变成文字，是语音助手、语音字幕、语音控制场景的核心模块。' +
    '它接收上游麦克风输出的音频流，调用浏览器内置的 Web Speech API 进行识别。' +
    '低于置信度阈值的识别结果会被忽略，避免噪音和含糊发音被错误识别。' +
    '实时流式模式适合边说边显示字幕；整句模式适合完整一句话的识别。',
  code: (p) => `# 语音识别：音频流 → 文本
lang       = "${p.language}"    # zh/en/auto
mode       = "${p.mode}"        # stream/sentence
min_conf   = ${p.confidenceThreshold}

# 初始化浏览器语音识别引擎
rec = speechRecognition.create(lang=lang, continuous=(mode=="stream"))

for transcript, confidence in rec.listen(audio_stream):
    if confidence >= min_conf:
        emit("text", transcript)  # 输出识别后的文字`,
}

// -------------------- 声音分类：识别声音类别（拍手/说话/笑声...） --------------------
const soundClassification: AIModule = {
  type: 'soundClassification',
  name: '声音分类',
  subtitle: 'Sound Classification',
  category: 'perception',
  icon: 'Music4',
  accent: '#3B82F6',
  description: '识别音频中的声音类型：拍手、说话、笑声、噪音、安静。',
  inputs: [{ id: 'audio', label: '音频', type: 'audio' }],
  outputs: [
    { id: 'label', label: '标签', type: 'label' },
    { id: 'confidence', label: '置信度', type: 'confidence' },
  ],
  params: [
    {
      id: 'classes',
      label: '类别列表（逗号分隔）',
      type: 'string',
      default: '拍手,说话,笑声,安静,噪音',
      editable: true,
    },
    {
      id: 'confidenceThreshold',
      label: '置信度阈值（0~1）',
      type: 'number',
      default: 0.6,
      min: 0.1,
      max: 1.0,
      step: 0.05,
      editable: true,
    },
  ],
  model: 'Teachable Machine Audio / WebAudio 特征提取',
  explanation:
    '声音分类识别"是什么声音"——拍手触发交互、教室噪音报警、掌声欢迎等。' +
    '它通过分析音频的频谱特征，从预定义类别中挑出最匹配的一项。' +
    '可搭配 Teachable Machine 训练自己的自定义声音模型。',
  code: (p) => `# 声音分类：音频 → 声音类别标签
classes = ["${(p.classes as string).split(',').join('","')}"]
threshold = ${p.confidenceThreshold}

features = audio.spectral_features(audio_in)
prediction = sound_model.predict(features, classes)

if prediction.confidence >= threshold:
    label      = prediction.class
    confidence = prediction.confidence`,
}

// -------------------- 音量检测：实时音量 + 阈值判断 --------------------
const volumeDetector: AIModule = {
  type: 'volumeDetector',
  name: '音量检测',
  subtitle: 'Volume Detector',
  category: 'perception',
  icon: 'BarChart3',
  accent: '#3B82F6',
  description: '检测音频流的实时音量，输出 0~100 数值 + 是否超阈值判断。',
  inputs: [{ id: 'audio', label: '音频', type: 'audio' }],
  outputs: [
    { id: 'number', label: '音量', type: 'number' },
    { id: 'signal', label: '超限', type: 'signal' },
  ],
  params: [
    {
      id: 'windowSize',
      label: '检测窗口（秒）',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 2.0,
      step: 0.1,
      editable: true,
    },
    {
      id: 'threshold',
      label: '音量阈值（0~100）',
      type: 'number',
      default: 60,
      min: 0,
      max: 100,
      step: 5,
      editable: true,
    },
  ],
  explanation:
    '音量检测回答"声音有多响"这一问题。它对窗口内的音频样本计算 RMS（均方根）得到 0~100 的音量值。' +
    '可用于噪音监控报警（音量超过阈值 → 超限信号 → 蜂鸣器）、声控装置（拍手 → 音量突增 → 触发）、或者课堂音量可视化。',
  code: (p) => `# 音量检测：音频流 → 音量数值 + 是否超阈值
window_size = ${p.windowSize}  # 秒
threshold   = ${p.threshold}   # 0~100

# 取窗口内平均音量（RMS → dB → 0~100 映射）
volume = 0
samples = audio_in.collect_window(window_size)
for s in samples:
    volume += s * s
volume = sqrt(volume / len(samples))
volume = min(100, int(volume * 100))  # 归一化到 0~100

is_loud = volume >= threshold          # 是否超过阈值`,
}

// -------------------- 文本合并：多文本拼接 + 模板 --------------------
const textMerge: AIModule = {
  type: 'textMerge',
  name: '文本合并',
  subtitle: 'Text Merge · 拼接',
  category: 'logic',
  icon: 'Link2',
  accent: '#6D28D9',
  description: '将 2~3 个文本输入拼接为一条输出，支持连接符和模板占位符。',
  inputs: [
    { id: 'text1', label: '文本 1', type: 'text' },
    { id: 'text2', label: '文本 2', type: 'text' },
    { id: 'text3', label: '文本 3', type: 'text' },
  ],
  outputs: [{ id: 'text', label: '合并后', type: 'text' }],
  params: [
    {
      id: 'separator',
      label: '连接符',
      type: 'string',
      default: ' ',
      editable: true,
    },
    {
      id: 'template',
      label: '模板格式（{1}{2}{3} 为占位符）',
      type: 'string',
      default: '{1}{2}{3}',
      editable: true,
    },
  ],
  explanation:
    '文本合并把多个来源的文字串成一句话，是文字播报、对话系统中常见的"组装"模块。' +
    '例如图像分类输出"猫" + 文本输入"我看到了一只" → 合并为"我看到了一只猫" → 送给 TTS 朗读。' +
    '简单场景用「连接符」（空格、逗号、换行）；复杂场景用「模板格式」（{1}{2}{3} 占位符）。',
  code: (p) => `# 文本合并：多个文本 → 一条文本
separator = "${p.separator}"
template  = '''${p.template}'''

# 先把已接收到的文本收集起来
parts = [text_in_1, text_in_2, text_in_3]

# 方法1：简单连接（默认模板 {1}{2}{3} + 自定义连接符）
text_out = separator.join(parts)

# 方法2：模板替换（优先使用模板）
text_out = template.replace("{1}", parts[0]) \
                   .replace("{2}", parts[1]) \
                   .replace("{3}", parts[2])`,
}

// -------------------- 计数器：累计触发次数 + 达标输出 --------------------
const counter: AIModule = {
  type: 'counter',
  name: '计数器',
  subtitle: 'Counter · 累加',
  category: 'logic',
  icon: 'Hash',
  accent: '#F97316',
  description: '统计信号触发次数，可自动重置或手动重置，达目标时输出达标信号。',
  inputs: [
    { id: 'trigger', label: '触发', type: 'signal' },
    { id: 'reset', label: '重置', type: 'signal' },
  ],
  outputs: [
    { id: 'number', label: '计数值', type: 'number' },
    { id: 'reached', label: '达标', type: 'signal' },
  ],
  params: [
    {
      id: 'target',
      label: '目标值（1~999）',
      type: 'number',
      default: 5,
      min: 1,
      max: 999,
      step: 1,
      editable: true,
    },
    {
      id: 'autoReset',
      label: '自动重置',
      type: 'select',
      default: 'off',
      options: [
        { label: '关（达到目标后保持）', value: 'off' },
        { label: '开（达到目标后归零）', value: 'on' },
      ],
      editable: true,
    },
  ],
  explanation:
    '计数器统计"发生了多少次"——进入5人报警、收集3个球胜利、拍手10次解锁。' +
    '它有两个输入端口：trigger 接"计数信号"（每次上升沿 count+1）、reset 接"重置信号"（归零）。' +
    '两个输出：number 是当前计数值（送数值显示/LED）、reached 是达标信号（送动作模块）。',
  code: (p) => `# 计数器：信号触发 → 累计次数
target     = ${p.target}
auto_reset = ${p.autoReset === 'on'}

count = 0         # 初始值
reached = False

# 每次 trigger 从假变真，计数+1
if trigger == rising_edge:
    count += 1

# 重置信号：count 归零
if reset == True:
    count = 0
    reached = False

# 达标判断
if count >= target:
    reached = True
    if auto_reset:
        count = 0`,
}

// -------------------- 延时器：信号延迟输出 --------------------
const delayTimer: AIModule = {
  type: 'delayTimer',
  name: '延时器',
  subtitle: 'Delay Timer · 延迟',
  category: 'logic',
  icon: 'Clock',
  accent: '#F97316',
  description: '接收触发信号后延迟指定时间再输出，适用于"延时欢迎""延时报警"等。',
  inputs: [{ id: 'trigger', label: '触发', type: 'signal' }],
  outputs: [{ id: 'delayed', label: '延时信号', type: 'signal' }],
  params: [
    {
      id: 'delay',
      label: '延时时间（0.1~30 秒）',
      type: 'number',
      default: 2,
      min: 0.1,
      max: 30,
      step: 0.5,
      editable: true,
    },
  ],
  explanation:
    '延时器让"动作"慢半拍发生——人进店 5 秒后才播报欢迎语（避免刚进门就被吓一跳）、' +
    '烟雾检测后 3 秒才响警报（避免误触发）、按按钮 2 秒后关灯方便走出去。' +
    '它不改变信号本身的真假，只改变"什么时候发出来"。',
  code: (p) => `# 延时器：收到触发 → N 秒后再输出
delay = ${p.delay}  # 秒

# 监测 trigger 的上升沿
if trigger == rising_edge:
    # 记录触发时间戳
    triggered_at = now()
    # 启动定时器，delay 秒后发送延迟信号
    schedule(delay, delayed=True)

# 触发信号消失时取消挂起的延迟（可选）
if trigger == falling_edge:
    cancel_scheduled()
    delayed = False`,
}

// -------------------- 文字显示：气泡框 / 打字机 / 纯文字 --------------------
const textDisplay: AIModule = {
  type: 'textDisplay',
  name: '文字显示',
  subtitle: 'Text Display · 气泡',
  category: 'output',
  icon: 'MessageCircle',
  accent: '#8B5CF6',
  description: '接收文本内容，在画布上以气泡框、打字机或纯文字样式显示。',
  inputs: [{ id: 'text', label: '文本', type: 'text' }],
  outputs: [],
  params: [
    {
      id: 'fontSize',
      label: '字体大小（12~72 px）',
      type: 'number',
      default: 24,
      min: 12,
      max: 72,
      step: 2,
      editable: true,
    },
    {
      id: 'textColor',
      label: '字体颜色',
      type: 'string',
      default: '#FFFFFF',
      editable: true,
    },
    {
      id: 'bgColor',
      label: '背景颜色',
      type: 'string',
      default: '#1A0F2E',
      editable: true,
    },
    {
      id: 'fontStyle',
      label: '字体样式',
      type: 'select',
      default: 'normal',
      options: [
        { label: '常规', value: 'normal' },
        { label: '粗体', value: 'bold' },
        { label: '斜体', value: 'italic' },
      ],
      editable: true,
    },
    {
      id: 'displayMode',
      label: '显示模式',
      type: 'select',
      default: 'bubble',
      options: [
        { label: '气泡框（漫画对白）', value: 'bubble' },
        { label: '纯文字', value: 'plain' },
        { label: '打字机效果', value: 'typewriter' },
      ],
      editable: true,
    },
    {
      id: 'duration',
      label: '持续时间（1~10 秒，0=永久）',
      type: 'number',
      default: 3,
      min: 0,
      max: 10,
      step: 1,
      editable: true,
    },
    {
      id: 'maxChars',
      label: '最大字数（1~200）',
      type: 'number',
      default: 50,
      min: 1,
      max: 200,
      step: 5,
      editable: true,
    },
  ],
  explanation:
    '文字显示模块把 AI 的回答、识别结果、提示消息以可视化方式"画"在画布上，' +
    '让数据流的文本层变得可见。气泡框模式模拟漫画对话、打字机模式是字幕常见效果、纯文字是控制台风格。' +
    '持续时间控制文字在屏幕上停留多久，0 表示永久显示（直到下一条新文本覆盖）。',
  code: (p) => `# 文字显示：把文本渲染到画布
font_size   = ${p.fontSize}
text_color  = "${p.textColor}"
bg_color    = "${p.bgColor}"
font_style  = "${p.fontStyle}"
mode        = "${p.displayMode}"
duration    = ${p.duration}    # 秒
max_chars   = ${p.maxChars}

# 超长截断
if len(text_in) > max_chars:
    text_in = text_in[:max_chars] + "…"

# 三种显示模式
if mode == "bubble":
    canvas.draw_speech_bubble(text_in, bg=bg_color, color=text_color)
elif mode == "plain":
    canvas.draw_text(text_in, color=text_color, style=font_style)
elif mode == "typewriter":
    for i in range(len(text_in)):
        canvas.draw_text(text_in[:i+1])
        sleep(0.05)

# 过一段时间自动清除（duration=0 不清除）
if duration > 0:
    sleep(duration)
    canvas.clear()`,
}

// -------------------- 蜂鸣器：短促音效 + 自定义文字朗读 --------------------
const buzzer: AIModule = {
  type: 'buzzer',
  name: '蜂鸣器',
  subtitle: 'Buzzer · 音效触发',
  category: 'output',
  icon: 'Megaphone',
  accent: '#F97316',
  description: '接收触发信号，播放短促音效（蜂鸣/警报/叮咚…）或自定义文字（短句播报）。',
  inputs: [
    { id: 'trigger', label: '触发', type: 'signal' },
    { id: 'text', label: '自定义文字（可选）', type: 'text', optional: true },
  ],
  outputs: [],
  params: [
    {
      id: 'playMode',
      label: '播放模式',
      type: 'select',
      default: 'sound',
      options: [
        { label: '音效库', value: 'sound' },
        { label: '自定义文字（朗读）', value: 'text' },
      ],
      editable: true,
    },
    {
      id: 'presetSound',
      label: '预设音效',
      type: 'select',
      default: 'beep',
      options: [
        { label: '🔔 蜂鸣（BEEP）', value: 'beep' },
        { label: '🚨 警报（ALARM）', value: 'alarm' },
        { label: '🎵 叮咚（DING DONG）', value: 'ding' },
        { label: '✅ 成功（SUCCESS）', value: 'success' },
        { label: '❌ 失败（FAIL）', value: 'fail' },
        { label: '💡 提示音（TIP）', value: 'tip' },
      ],
      editable: true,
    },
    {
      id: 'volume',
      label: '音量（0~100%）',
      type: 'number',
      default: 70,
      min: 0,
      max: 100,
      step: 5,
      editable: true,
    },
    {
      id: 'duration',
      label: '单次持续（0.1~5 秒）',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 5,
      step: 0.1,
      editable: true,
    },
    {
      id: 'repeat',
      label: '重复次数（1~10）',
      type: 'number',
      default: 1,
      min: 1,
      max: 10,
      step: 1,
      editable: true,
    },
  ],
  explanation:
    '蜂鸣器是「提醒装置」——用短促音效或短句，在 AI 判断成立时给出声音反馈。' +
    '它与音频播放器（TTS）的区别：蜂鸣器是信号触发的"提示音/警报"，内容短、重复、带情绪；' +
    'TTS 是文本驱动的"完整语音"，内容长、连贯。两者是互补关系。' +
    '可设置重复次数实现连续蜂鸣（警报场景），也可连接 text_in 播报自定义短句。',
  code: (p) => `# 蜂鸣器：信号触发 → 播放音效/自定义文字
mode        = "${p.playMode}"
preset_snd  = "${p.presetSound}"
volume      = ${p.volume} / 100
duration    = ${p.duration}    # 秒
repeat      = ${p.repeat}

# 只对 trigger 的上升沿（true→从false来的true）响应
if trigger == rising_edge:
    for i in range(repeat):
        if mode == "sound":
            # 播放内置音效
            audio.play(preset_snd, volume=volume, length=duration)
        elif mode == "text":
            # 朗读自定义文字（如果连了 text_in）
            audio.speak(text_in, volume=volume)
        sleep(duration + 0.05)  # 间隔`,
}

// -------------------- TTS 音频播放器：文本转语音 --------------------
const ttsPlayer: AIModule = {
  type: 'ttsPlayer',
  name: '音频播放器',
  subtitle: 'TTS Player · 语音朗读',
  category: 'output',
  icon: 'Volume2',
  accent: '#10B981',
  description: '接收文本内容，通过浏览器 SpeechSynthesis API 朗读为语音。',
  inputs: [{ id: 'text', label: '文本', type: 'text' }],
  outputs: [],
  params: [
    {
      id: 'voice',
      label: '语音引擎',
      type: 'select',
      default: 'female',
      options: [
        { label: '👩 女声（默认）', value: 'female' },
        { label: '👨 男声', value: 'male' },
        { label: '👧 童声', value: 'child' },
      ],
      editable: true,
    },
    {
      id: 'rate',
      label: '语速（0.5~2.0 倍）',
      type: 'number',
      default: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.1,
      editable: true,
    },
    {
      id: 'pitch',
      label: '音调（0.5~2.0）',
      type: 'number',
      default: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.1,
      editable: true,
    },
    {
      id: 'volume',
      label: '音量（0~100%）',
      type: 'number',
      default: 80,
      min: 0,
      max: 100,
      step: 5,
      editable: true,
    },
    {
      id: 'queueMode',
      label: '播放模式',
      type: 'select',
      default: 'queue',
      options: [
        { label: '排队播放（避免重叠，推荐）', value: 'queue' },
        { label: '即时打断（新文本立刻播）', value: 'immediate' },
      ],
      editable: true,
    },
  ],
  model: 'Web Speech Synthesis API (浏览器内置)',
  explanation:
    'TTS = Text to Speech，文本转语音，是语音助手、无障碍播报、AI 对话的嘴巴。' +
    '与蜂鸣器不同：TTS 专门朗读"完整的话"（一句话、一段话），蜂鸣器专门播"提示音/警报"。' +
    '排队播放模式保证不重音（前面说完才说下一句）；即时打断适合命令型交互。' +
    '实际声音效果取决于操作系统提供的语音引擎（Windows/Chrome 自带高质量中文语音）。',
  code: (p) => `# TTS 音频播放器：文本 → 语音朗读
voice_type = "${p.voice}"    # female/male/child
rate       = ${p.rate}       # 语速
pitch      = ${p.pitch}      # 音调
volume     = ${p.volume} / 100
queue_mode = "${p.queueMode}"  # queue / immediate

# 选择匹配的系统声音
voice = voices.select(gender=voice_type, lang="zh-CN")

# 根据模式处理重复文本
if queue_mode == "immediate":
    speech.cancel()  # 打断当前
    speech.speak(text_in, voice=voice, rate=rate, pitch=pitch, volume=volume)
else:
    speech.enqueue(text_in, voice=voice, rate=rate, pitch=pitch, volume=volume)`,
}

// -------------------- LED 指示灯：布尔状态可视化 --------------------
const ledIndicator: AIModule = {
  type: 'ledIndicator',
  name: 'LED 指示灯',
  subtitle: 'LED Indicator',
  category: 'output',
  icon: 'Lightbulb',
  accent: '#FBBF24',
  description: '接收布尔或信号输入，显示简单灯光，可自定义颜色和闪烁效果。',
  inputs: [{ id: 'signal', label: '信号', type: 'signal' }],
  outputs: [],
  params: [
    {
      id: 'color',
      label: '灯光颜色',
      type: 'string',
      default: '#10B981',
      editable: true,
    },
    {
      id: 'blink',
      label: '闪烁模式',
      type: 'select',
      default: 'off',
      options: [
        { label: '关（持续亮）', value: 'off' },
        { label: '开（亮时闪烁）', value: 'on' },
      ],
      editable: true,
    },
    {
      id: 'blinkFreq',
      label: '闪烁频率（1~10 Hz）',
      type: 'number',
      default: 2,
      min: 1,
      max: 10,
      step: 1,
      editable: true,
    },
  ],
  explanation:
    'LED 指示灯是最简单的可视化输出——信号为真就亮，为假就灭。' +
    '它把信号真假变成"眼睛能看见的灯"，是调试电路、搭建实物模型（交通灯、状态机）时最常用的模块。' +
    '可自定义颜色模拟红/黄/绿交通灯；闪烁模式适合告警/待机指示。',
  code: (p) => `# LED 指示灯：信号 → 亮/灭
color      = "${p.color}"
blink_mode = "${p.blink}"
blink_hz   = ${p.blinkFreq}

if signal == True:
    if blink_mode == "on":
        led.blink(color=color, freq=blink_hz)   # 闪烁
    else:
        led.on(color=color)                      # 持续亮
else:
    led.off()                                     # 灭`,
}

// -------------------- 生态预览：开放架构愿景（第二、三阶段开放） --------------------
const previewModules: AIModule[] = [
  {
    type: 'ocr',
    name: 'OCR',
    subtitle: '文字识别',
    category: 'perception',
    icon: 'ScanText',
    accent: '#d4a04a',
    description: '识别图像中的文字。',
    inputs: [{ id: 'image', label: '图像', type: 'image' }],
    outputs: [{ id: 'text', label: '文本', type: 'text' }],
    params: [],
    model: 'Tesseract.js',
    explanation: '把图像里的像素翻译成可读文字。',
    code: () => `text = ocr.recognize(image)`,
  },
  {
    type: 'llm',
    name: 'LLM',
    subtitle: '大语言模型',
    category: 'perception',
    icon: 'Sparkles',
    accent: '#a888c7',
    description: '理解与生成文本。',
    inputs: [{ id: 'text', label: '文本', type: 'text' }],
    outputs: [{ id: 'text', label: '文本', type: 'text' }],
    params: [],
    model: 'Gemini / 本地 LLM',
    explanation: '根据输入文本生成回应，可用于对话、创作、推理。',
    code: () => `reply = llm.generate(prompt)`,
  },
  {
    type: 'textToImage',
    name: 'Text → Image',
    subtitle: '图像生成',
    category: 'output',
    icon: 'ImagePlus',
    accent: '#d4825a',
    description: '根据文字描述生成图像。',
    inputs: [{ id: 'text', label: '文本', type: 'text' }],
    outputs: [{ id: 'image', label: '图像', type: 'image' }],
    params: [],
    model: 'Stable Diffusion',
    explanation: '生成式 AI：从文字创造从未存在的图像。',
    code: () => `image = diffusion.generate(prompt)`,
  },
]

export const MODULES: Record<string, AIModule> = {
  camera,
  imageClassifier,
  objectDetection,
  speechRecognition,
  soundClassification,
  volumeDetector,
  if: ifNode,
  output,
  microphone,
  textInput,
  imageInput,
  and: andNode,
  or: orNode,
  not: notNode,
  timer: timerNode,
  counter,
  delayTimer,
  textMerge,
  textDisplay,
  buzzer,
  ttsPlayer,
  ledIndicator,
  // 关卡专用模块
  sceneCamera,
  trashClassifier,
  roboticArm,
  ...Object.fromEntries(previewModules.map((m) => [m.type, m])),
}

/** 核心可用模块类型 */
export const CORE_MODULE_TYPES = [
  'camera',
  'imageClassifier',
  'objectDetection',
  'speechRecognition',
  'soundClassification',
  'volumeDetector',
  'if',
  'output',
  'microphone',
  'textInput',
  'imageInput',
  'and',
  'or',
  'not',
  'timer',
  'counter',
  'delayTimer',
  'textMerge',
  'textDisplay',
  'buzzer',
  'ttsPlayer',
  'ledIndicator',
]

/** 预览模块类型（市场展示，暂不可拖入） */
export const PREVIEW_MODULE_TYPES = previewModules.map((m) => m.type)

export function isPreview(type: string): boolean {
  return PREVIEW_MODULE_TYPES.includes(type)
}

export function getModule(type: string): AIModule | undefined {
  // 先查内置模块
  const builtin = MODULES[type]
  if (builtin) return builtin
  // 再查自定义模块
  return undefined
}

/** 动态注册模块（运行时添加到 MODULES 表） */
export function registerDynamicModule(mod: AIModule) {
  MODULES[mod.type] = mod
}

/** 注销动态注册的模块 */
export function unregisterDynamicModule(type: string) {
  delete MODULES[type]
}

/** 按分类分组（市场用） */
export const MODULES_BY_CATEGORY: Record<ModuleCategory, AIModule[]> = {
  input: [camera, microphone, textInput, imageInput, ...previewModules.filter((m) => m.category === 'input')],
  perception: [
    imageClassifier,
    objectDetection,
    speechRecognition,
    soundClassification,
    volumeDetector,
    ...previewModules.filter((m) => m.category === 'perception'),
  ],
  logic: [ifNode, andNode, orNode, notNode, timerNode, counter, delayTimer, textMerge],
  output: [output, textDisplay, buzzer, ttsPlayer, ledIndicator, ...previewModules.filter((m) => m.category === 'output')],
}

export const CATEGORY_META: Record<ModuleCategory, { label: string; icon: string; accent: string }> = {
  input: { label: '输入 · 感知世界', icon: 'Eye', accent: '#6ba3c3' },
  perception: { label: 'AI · 理解世界', icon: 'BrainCircuit', accent: '#d4a04a' },
  logic: { label: '逻辑 · 思考决策', icon: 'GitBranch', accent: '#8aab6e' },
  output: { label: '行动 · 改变世界', icon: 'Lightbulb', accent: '#d4825a' },
}

// -------------------- 关卡专用专栏 --------------------
// 这些元件仅在关卡模式出现，由 paletteFilter 决定本关解锁哪些
export const LEVEL_MODULES: AIModule[] = [sceneCamera, trashClassifier, roboticArm]

/** 关卡专栏元数据（独立于四大核心分类） */
export const LEVEL_CATEGORY_META = {
  label: '关卡专用 · 场景设备',
  icon: 'Compass',
  accent: '#a888c7',
}
