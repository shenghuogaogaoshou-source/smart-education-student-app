const CRISIS_CONTENT = /自杀|自残|轻生|不想活|伤害自己|结束生命/i
const SEXUAL_CONTENT = /裸照|裸体|色情|性爱|性行为|成人内容|未成年.*性/i
const VIOLENT_OR_ILLEGAL_CONTENT = /武器|炸弹|爆炸物|杀人|下毒|毒品|赌博|诈骗|盗号|破解|绕过监管|跟踪别人/i
const RUDE_CONTENT = /笨蛋|笨|蠢|垃圾|滚开|去死|傻子/i
const PRIVACY_CONTENT = /(?:手机号|电话|联系方式|邮箱|住址|家庭地址|学校地址|密码|验证码|身份证|定位|经纬度|银行卡|账号)\s*(?:是|为|：|:)?\s*[\w@.+*\-\u4e00-\u9fff]{3,}|1[3-9]\d{9}/i
const UNCLEAR_REQUEST = /^(?:那个|这个|它|帮我弄(?:一下)?|帮我搞(?:一下)?|你看着办|随便弄|就这样)(?:呢|吧|啊|呀|嘛|一下|可以吗|怎么弄)?[。？！?!]*$/i
const MAX_QUESTION_LENGTH = 160
const MAX_REPLY_LENGTH = 110

const COMPANION_NAMES = new Map([
  ['momo', '绒桃 Momo'],
  ['yunduo', '云朵 Yunduo'],
  ['cloudbloom', '云绽 Cloudbloom'],
  ['cloudbelle', '云贝儿 Cloudbelle'],
])

const PRIMARY_INSTRUCTION = '面向小学生：用亲切、具体、好理解的中文回答，可以使用一个轻松的比喻；不幼稚化、不说教。'

export function prepareStudentQuestion(question, companionId) {
  const text = typeof question === 'string' ? question.trim().replace(/\s+/g, ' ') : ''
  if (!text || text.length > MAX_QUESTION_LENGTH) throw new Error('invalid_question')
  const normalizedCompanionId = COMPANION_NAMES.has(companionId) ? companionId : 'momo'

  if (CRISIS_CONTENT.test(text)) {
    return {
      companionId: normalizedCompanionId,
      question: text,
      directReply: '听起来你现在很难受。请马上告诉身边可信任的成年人、家长或老师；如果有立即危险，请联系当地紧急服务。',
    }
  }
  if (PRIVACY_CONTENT.test(text)) {
    return {
      companionId: normalizedCompanionId,
      question: text,
      directReply: '为了保护你的隐私，请不要在聊天里发送电话、地址、密码或验证码。需要帮助时可以请监护人或老师一起处理。',
    }
  }
  if (SEXUAL_CONTENT.test(text) || VIOLENT_OR_ILLEGAL_CONTENT.test(text)) {
    return {
      companionId: normalizedCompanionId,
      question: text,
      directReply: '这个内容不适合在这里展开。我们可以换成安全的学习、科普或创作问题。',
    }
  }
  if (RUDE_CONTENT.test(text)) {
    return {
      companionId: normalizedCompanionId,
      question: text,
      directReply: '我愿意继续帮你，不过我们换一种尊重彼此的说法，好吗？',
    }
  }
  if (UNCLEAR_REQUEST.test(text) || (/那个|这个|帮我弄|帮我搞/.test(text) && text.length <= 10)) {
    return {
      companionId: normalizedCompanionId,
      question: text,
      directReply: '我还没完全听懂，能换一种说法告诉我吗？',
    }
  }

  return { companionId: normalizedCompanionId, question: text }
}

export function buildDeepSeekPayload({ companionId, question }) {
  const companionName = COMPANION_NAMES.get(companionId) ?? '绒桃 Momo'
  return {
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    temperature: .7,
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content: `你是数智教育学生端的 AI 伙伴，当前形象是${companionName}。${PRIMARY_INSTRUCTION}只回答学习、科普、创作启发或简单的日常问题。回答不超过 2 句话、110 个汉字左右，不使用 Markdown。遇到信息不足时先礼貌澄清，不猜测学生意图。不要索取姓名、精确出生日期、学校班级、住址、联系方式、密码、验证码、定位或照片；不要假装是真人、老师、家长、医生、律师或心理治疗师；不要替学生执行操作。学习问题优先给思路和提示，不代做整份作业或考试答案。医疗、法律、金融或心理健康问题只做通俗教育并建议咨询可信任的成年人或专业人士。遇到危险、成人、暴力、自伤、违法、隐私或不礼貌内容，简短拒绝并转向安全帮助。`,
      },
      { role: 'user', content: question },
    ],
  }
}

export function prepareStudentReply(reply) {
  let text = typeof reply === 'string' ? reply.trim().replace(/\s+/g, ' ') : ''
  if (!text || SEXUAL_CONTENT.test(text) || VIOLENT_OR_ILLEGAL_CONTENT.test(text) || RUDE_CONTENT.test(text) || PRIVACY_CONTENT.test(text)) {
    return '这个话题我不适合这样回答。我们换个方式，一起安全地学习，好吗？'
  }
  if (CRISIS_CONTENT.test(text)) {
    return '如果你正想伤害自己，请马上告诉身边可信任的成年人、家长或老师；有立即危险时请联系当地紧急服务。'
  }
  const completedSentences = text.match(/[^。！？!?]*[。！？!?]+/g)
  if (completedSentences && completedSentences.length >= 2) {
    text = completedSentences.slice(0, 2).join('').trim()
  }
  if (text.length <= MAX_REPLY_LENGTH) return text

  const clipped = text.slice(0, MAX_REPLY_LENGTH)
  const sentenceEnd = Math.max(clipped.lastIndexOf('。'), clipped.lastIndexOf('！'), clipped.lastIndexOf('？'))
  return `${(sentenceEnd > 24 ? clipped.slice(0, sentenceEnd + 1) : clipped).trim()}…`
}
