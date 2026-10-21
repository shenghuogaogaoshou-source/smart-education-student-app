const privacyHint = '别写真实姓名、学校、住址或联系方式。';

export function creationGuide(stage, state = {}) {
  const guides = {
    card: {
      title: '先抽三张脑洞卡',
      prompt: '先选谁、在哪里、想做什么，再把剩下的空白交给你的想象力。',
      primaryAction: '继续抽卡',
    },
    idea: {
      title: '讲出你的独家想法',
      prompt: '写下角色最想完成的一件事，越具体，故事越像你的。',
      primaryAction: '整理想法',
    },
    story: {
      title: '把你的设定拍成故事',
      prompt: 'AI 会保留你的设定；不满意就换一种写法，导演永远是你。',
      primaryAction: '生成剧本',
    },
    style: {
      title: '给影片选一种感觉',
      prompt: '选一种你喜欢的画风，再想想它应该明亮、神秘还是热闹。',
      primaryAction: '确定画风',
    },
    board: {
      title: '给这一幕搭画面',
      prompt: '写清谁、在哪里、做什么，画面会更像你想的。',
      primaryAction: '生成分镜',
    },
    prem: {
      title: '准备首映',
      prompt: '先看看每一格是不是你想要的，再决定要不要生成影片。',
      primaryAction: '播放作品',
    },
  };

  const guide = guides[stage] || guides.card;
  return { ...guide, privacyHint, hasDraft: Boolean(state.story || state.idea) };
}

export function friendlyGenerationError(module, message = '') {
  if (module === 'video') {
    return {
      message: '网络暂时没连好，先用本机录制把作品放出来；你的分镜和剧本都保留着。',
      fallbackAction: '本机录制',
    };
  }
  if (/代理|火山|网络|timeout|超时|连不上|fetch/i.test(String(message))) {
    return {
      message: 'AI 片场暂时连不上，稍等后点重试；你的草稿已经保留。',
      fallbackAction: '重试',
    };
  }
  return {
    message: '这次没有生成成功，改一改描述后再试试；你的草稿没有丢。',
    fallbackAction: '重试',
  };
}
