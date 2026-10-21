import { creationGuide, friendlyGenerationError } from './creationGuide.js';
import { LONG_PRESS_MS, SLIDE_CANCEL_PX, moveCard, reorderSlot } from './slotDrag.js';
import { CONCURRENCY, MAX_CLIP_SECONDS, estimateFilm, panelPrompt, pendingSegments, planSegments } from './filmPlan.js';
import { saveFilmToZhiya } from './integration/saveToZhiya';

/** @param {HTMLElement} root */
export function mountStudio(root, onNavigate = (stage) => {}) {
  const controller = new AbortController();
  const nativeDocument = window.document;
  const document = new Proxy(nativeDocument, {
    get(target, key) {
      if (key === 'querySelector') return root.querySelector.bind(root);
      if (key === 'querySelectorAll') return root.querySelectorAll.bind(root);
      if (key === 'addEventListener') return (type, listener, options) => root.addEventListener(type, listener, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: controller.signal });
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
/* ============================================================
   脑洞放映厅 · 数据层(v4:一张卡只干一件事)
   六类槽位各 50 张卡,顺序按故事发展排:
     主角(谁) → 场景(在哪) → 配角(和谁) → 经过(想做什么) → 转折(没想到) → 道具(带着什么)
   规则:
     · 主角卡 = 身份 + 一个外观/性格特点(不写"想要什么""怕什么",那是经过和转折的事)
     · 场景卡 = 只写地方(不放道具、不自带另一个主角、不自带事件)
     · 配角卡 = 帮手 / 对手 / 需要帮助的人 三类都有,故事才有冲突
     · 经过卡 = 一个目标或任务(比赛、秘密、约定、选择…多种形状)
     · 转折卡 = 意外现象(30 张)+ 情感关系(20 张)
     · 道具卡 = 物件/信物(能带在身上,也可能成为关键)
   孩子可以在**任意一个格子**里"自己写一张卡",写过的卡会存进那个格子的卡池,以后还能抽到。
   ============================================================ */

/* ---------- 六大槽位(每类 50 张) ---------- */
const SLOT_DEFS = [
  {
    key: 'hero', name: '主角', emoji: '🦸', required: true,
    hint: '故事围绕谁展开?',
    cards: [
      { t: '圆滚滚的小鲸鱼', e: '🐋' }, { t: '戴圆眼镜的小蜗牛', e: '🐌' }, { t: '耳朵特别大的小狐狸', e: '🦊' },
      { t: '走路摇摇摆摆的小企鹅', e: '🐧' }, { t: '胡子卷卷的山羊爷爷', e: '🐐' }, { t: '总拖着围巾的小猫', e: '🐱' },
      { t: '身上有花纹的小恐龙', e: '🦕' }, { t: '爱抖耳朵的小兔子', e: '🐰' }, { t: '背着书包的小刺猬', e: '🦔' },
      { t: '尾巴像扇子的小松鼠', e: '🐿️' }, { t: '鼻子会冒泡的小海豹', e: '🦭' }, { t: '头顶有撮呆毛的小熊', e: '🐻' },
      { t: '圆耳朵的小老鼠', e: '🐭' }, { t: '爪子沾满颜料的小猴子', e: '🐵' }, { t: '脖子很长的小长颈鹿', e: '🦒' },
      { t: '眯着眼睛的小考拉', e: '🐨' }, { t: '羽毛油亮的小乌鸦', e: '🐦‍⬛' }, { t: '爱梳头的小孔雀', e: '🦚' },
      { t: '嘴巴扁扁的小鸭子', e: '🦆' }, { t: '壳上画着星星的小乌龟', e: '🐢' }, { t: '触手很多的小章鱼', e: '🐙' },
      { t: '走路带风的小马', e: '🐴' }, { t: '牙齿小小的鳄鱼宝宝', e: '🐊' }, { t: '总在甩尾巴的小狗', e: '🐶' },
      { t: '脖子上挂铃铛的小羊', e: '🐑' }, { t: '鬃毛乱蓬蓬的小狮子', e: '🦁' }, { t: '会喷水的小象', e: '🐘' },
      { t: '住在草丛里的蟋蟀', e: '🦗' }, { t: '翅膀有斑点的小蝴蝶', e: '🦋' }, { t: '圆圆的小瓢虫', e: '🐞' },
      { t: '慢慢吞吞的树懒', e: '🦥' }, { t: '总在打哈欠的小老虎', e: '🐯' }, { t: '白胖胖的小雪人', e: '⛄' },
      { t: '会发光的小蘑菇精', e: '🍄' }, { t: '圆石头一样的小石头人', e: '🗿' }, { t: '会走路的小水滴', e: '💧' },
      { t: '一蹦一跳的小火苗', e: '🔥' }, { t: '头顶有小星星的小精灵', e: '🧚' }, { t: '穿背带裤的小机器人', e: '🤖' },
      { t: '圆滚滚的小熊猫', e: '🐼' }, { t: '长耳朵的小鹿', e: '🦌' }, { t: '会变色的小蜥蜴', e: '🦎' },
      { t: '胖乎乎的小浣熊', e: '🦝' }, { t: '背上带刺的小野猪', e: '🐗' }, { t: '蹦蹦跳跳的小袋鼠', e: '🦘' },
      { t: '圆眼睛的小猫头鹰', e: '🦉' }, { t: '皮肤滑滑的小海豚', e: '🐬' }, { t: '倒挂着的小蝙蝠', e: '🦇' },
      { t: '总排成一行的小蚂蚁', e: '🐜' }, { t: '落在窗台的小麻雀', e: '🐦' },
    ],
  },
  {
    key: 'scene', name: '场景', emoji: '🏞️', required: true,
    hint: '故事发生在哪里?',
    cards: [
      { t: '海底理发店', e: '💈' }, { t: '云朵上的图书馆', e: '📚' }, { t: '月亮的背面', e: '🌙' },
      { t: '倒着长的森林', e: '🌲' }, { t: '会唱歌的草原', e: '🎵' }, { t: '深夜的便利店', e: '🏪' },
      { t: '装满旧玩具的阁楼', e: '🧸' }, { t: '火山脚下的邮局', e: '📮' }, { t: '挤满风的山谷', e: '🌬️' },
      { t: '会眨眼的星空', e: '✨' }, { t: '海底的图书馆', e: '🐠' }, { t: '雨天的屋顶', e: '🌧️' },
      { t: '结冰的湖面', e: '🧊' }, { t: '长满彩虹的梯田', e: '🌈' }, { t: '树洞里的剧场', e: '🎭' },
      { t: '会消失的小路', e: '🛤️' }, { t: '黄昏的操场', e: '🌆' }, { t: '会呼吸的山洞', e: '🕳️' },
      { t: '开在天上的花店', e: '💐' }, { t: '只有一平米的小岛', e: '🏝️' }, { t: '老火车的月台', e: '🚂' },
      { t: '会漂走的小冰山', e: '🏔️' }, { t: '堆满毛线的房间', e: '🧶' }, { t: '巨大蘑菇伞下面', e: '🍄' },
      { t: '铺着棉花糖的路', e: '🍡' }, { t: '寂静的钟楼', e: '🕰️' }, { t: '挂满灯笼的巷子', e: '🏮' },
      { t: '被遗忘的花园', e: '🌷' }, { t: '铅笔画的操场', e: '✏️' }, { t: '会说话的井边', e: '🪣' },
      { t: '铺满信的沙滩', e: '✉️' }, { t: '老钟表铺', e: '⌚' }, { t: '会下雪的房间', e: '❄️' },
      { t: '倒流的河', e: '🌊' }, { t: '只有夜晚的城', e: '🌃' }, { t: '会升起的草坪', e: '🪁' },
      { t: '饼干做的房子', e: '🍪' }, { t: '会走路的糖果街', e: '🍬' }, { t: '玻璃做的温室', e: '🌿' },
      { t: '会浮起来的码头', e: '⚓' }, { t: '只在春天出现的车站', e: '🚉' }, { t: '星星掉下来的湖', e: '💫' },
      { t: '藏着回声的长廊', e: '🗣️' }, { t: '顶楼的天文台', e: '🔭' }, { t: '会变色的山谷', e: '🏞️' },
      { t: '长满蒲公英的坡地', e: '🌼' }, { t: '睡着的火山口', e: '🌋' }, { t: '港口尽头的灯塔', e: '🗼' },
      { t: '铺着雪的小巷', e: '🏘️' }, { t: '云下面的吊桥', e: '🌉' },
    ],
  },
  {
    key: 'side', name: '配角', emoji: '🧑‍🤝‍🧑', required: false,
    hint: '(可选)谁在主角身边?',
    cards: [
      /* —— 帮手 —— */
      { t: '爱唠叨的鹦鹉', e: '🦜' }, { t: '慢吞吞的老乌龟', e: '🐢' }, { t: '会带路的萤火虫', e: '🪲' },
      { t: '会织毛衣的奶奶', e: '🧶' }, { t: '爱种花的小女孩', e: '🌷' }, { t: '会做汤的熊', e: '🥣' },
      { t: '会写信的鸽子', e: '🕊️' }, { t: '会修玩具的小熊', e: '🧸' }, { t: '会看天气的蚂蚁', e: '🐜' },
      { t: '会弹琴的蟋蟀', e: '🎻' }, { t: '会做饭的浣熊', e: '🍳' }, { t: '会找东西的猎犬', e: '🐕' },
      { t: '会剪头发的螃蟹', e: '💈' }, { t: '会做风筝的老人', e: '🪁' }, { t: '会算账的松鼠', e: '🧮' },
      { t: '会补梦的小精灵', e: '🧝' }, { t: '会唱歌的鲸鱼', e: '🐋' }, { t: '会打鼓的啄木鸟', e: '🥁' },
      /* —— 对手 / 捣蛋鬼(故事要有冲突) —— */
      { t: '总抢东西的乌鸦', e: '🐦‍⬛' }, { t: '爱告状的小狐狸', e: '🦊' }, { t: '喜欢藏鞋子的狗', e: '🐕‍🦺' },
      { t: '一定要拿第一的兔子', e: '🐰' }, { t: '爱吹牛的青蛙', e: '🐸' }, { t: '脾气很急的公鸡', e: '🐔' },
      { t: '总在催人的闹钟精', e: '⏰' }, { t: '爱占地方的河马', e: '🦛' }, { t: '总爱插队的企鹅', e: '🐧' },
      { t: '喜欢恶作剧的猫', e: '🐱' }, { t: '偷吃点心的小老鼠', e: '🐭' }, { t: '爱抢镜头的孔雀', e: '🦚' },
      { t: '总说"不行"的看门狗', e: '🐶' }, { t: '爱把东西藏起来的章鱼', e: '🐙' }, { t: '一点就炸的刺猬', e: '🦔' },
      { t: '总在抱怨的驴', e: '🫏' },
      /* —— 需要主角帮忙的人 —— */
      { t: '不敢说话的小女孩', e: '👧' }, { t: '怕黑的小弟弟', e: '👦' }, { t: '迷路的旅行者', e: '🧳' },
      { t: '找不到家的小猫', e: '🐈' }, { t: '还不会飞的雏鸟', e: '🐣' }, { t: '爱哭的小妹妹', e: '👶' },
      { t: '丢了眼镜的老先生', e: '👓' }, { t: '走不动路的小蜗牛', e: '🐌' }, { t: '忘了歌词的小鸟', e: '🐦' },
      { t: '掉队的小羊', e: '🐑' }, { t: '摔坏翅膀的小蜻蜓', e: '🪰' }, { t: '一个人过生日的小熊', e: '🎂' },
      { t: '不敢下水的小鸭子', e: '🦆' }, { t: '忘记怎么跳的小袋鼠', e: '🦘' }, { t: '声音很小的小羊羔', e: '🐏' },
      { t: '找不到妈妈的小企鹅', e: '🐧' },
    ],
  },
  {
    key: 'plot', name: '经过', emoji: '➡️', required: true,
    hint: '一路上想做什么、发生了什么?',
    cards: [
      { t: '想给海浪剪短发', e: '✂️' }, { t: '要找回丢掉的声音', e: '🔇' }, { t: '帮月亮修补缺口', e: '🌗' },
      { t: '给星星送一封信', e: '✉️' }, { t: '想把影子要回来', e: '👤' }, { t: '要教石头唱歌', e: '🎵' },
      { t: '找一种不会化的雪', e: '❄️' }, { t: '要给云朵称体重', e: '⚖️' }, { t: '把雨装进瓶子里', e: '🍾' },
      { t: '给迷路的蚂蚁带路', e: '🐜' }, { t: '寻找会唱歌的贝壳', e: '🐚' }, { t: '想做一件最大的毛衣', e: '🧶' },
      { t: '把太阳从海里捞起来', e: '🌅' }, { t: '要修复摔碎的月光', e: '🌙' }, { t: '想办法让朋友笑', e: '😄' },
      { t: '给风起一个名字', e: '🍃' }, { t: '找回被偷走的梦', e: '💤' }, { t: '想学会倒着走路', e: '👣' },
      { t: '想和影子换一天', e: '🌑' }, { t: '帮小岛搬家', e: '🏝️' }, { t: '要把哭声变成歌声', e: '🎤' },
      { t: '寻找最后一颗糖', e: '🍭' }, { t: '把迷路的孩子送回家', e: '🏠' }, { t: '想借一点勇气', e: '🦁' },
      { t: '给老树过生日', e: '🎂' }, { t: '想把海浪叠起来', e: '🌊' }, { t: '找回会跑走的鞋子', e: '👟' },
      { t: '把丢掉的时光找回来', e: '⏳' }, { t: '帮小鱼开一场演唱会', e: '🐟' }, { t: '想把彩虹捆起来', e: '🌈' },
      { t: '送一只蜗牛去看海', e: '🐌' }, { t: '帮蝴蝶修好翅膀', e: '🦋' }, { t: '要让钟声再响一次', e: '🔔' },
      { t: '给荒岛种一棵树', e: '🌱' }, { t: '把旧的玩具修好', e: '🔧' }, { t: '想给太阳撑把伞', e: '☂️' },
      { t: '把迷路的云送回去', e: '☁️' }, { t: '寻找会说话的钥匙', e: '🔑' }, { t: '想把快乐分一半', e: '💛' },
      /* —— 另外几种故事形状:比赛 / 秘密 / 约定 / 选择 / 照顾 / 归还 —— */
      { t: '去参加一场奇怪的比赛', e: '🏁' }, { t: '守住一个不能说出口的秘密', e: '🤫' },
      { t: '完成很久以前的一个约定', e: '🤝' }, { t: '在两条路里选一条', e: '🛤️' },
      { t: '学着照顾一颗蛋', e: '🥚' }, { t: '把借来的东西还回去', e: '📦' },
      { t: '想让花在冬天开', e: '🌸' }, { t: '陪一个人等天黑', e: '🌇' },
      { t: '练习说出"对不起"', e: '💬' }, { t: '去补一次迟到的道歉', e: '💐' },
      { t: '把忘记的生日记起来', e: '🎈' },
    ],
  },
  {
    key: 'turn', name: '转折', emoji: '⚡', required: false,
    hint: '(可选)突然发生了什么?',
    cards: [
      /* —— 30 张:意外现象 —— */
      { t: '突然下起了糖果雨', e: '🍬' }, { t: '夜里所有的影子都不见了', e: '🌑' }, { t: '钟声一响,时间停了', e: '⏰' },
      { t: '海浪忽然开口说话', e: '🌊' }, { t: '天上多出了一个月亮', e: '🌙' }, { t: '钥匙自己跑掉了', e: '🔑' },
      { t: '整条街都变成了纸', e: '📄' }, { t: '下了一场红色的雪', e: '❄️' }, { t: '所有的信都被退了回来', e: '✉️' },
      { t: '风把屋顶吹去了很远', e: '🌪️' }, { t: '影子开始自己走路', e: '👤' }, { t: '太阳迟到了整整一天', e: '🌅' },
      { t: '玩具们全都不见了', e: '🧸' }, { t: '声音忽然被收走了', e: '🔇' }, { t: '镜子里的自己眨了眨眼', e: '🪞' },
      { t: '脚印一路通到了天上', e: '👣' }, { t: '石头像花瓣一样飘起来', e: '🪨' }, { t: '海洋变成了一面大镜子', e: '🌊' },
      { t: '所有颜色都跑掉了', e: '🎨' }, { t: '钟表开始倒着走', e: '🕰️' }, { t: '雨往上飘了', e: '🌧️' },
      { t: '那首歌忽然谁都唱不出', e: '🎵' }, { t: '地上裂开一条发光的路', e: '✨' }, { t: '云掉下来落在了地上', e: '☁️' },
      { t: '小镇忽然飘到了半空', e: '🏘️' }, { t: '那只猫开口说了人话', e: '🐱' }, { t: '信上出现了陌生的字', e: '📜' },
      { t: '海水一夜之间退走了', e: '🐚' }, { t: '树长进了屋子里', e: '🌳' }, { t: '一切都回到了开场', e: '🔁' },
      /* —— 20 张:情感与关系(故事的另一半) —— */
      { t: '最好的朋友说再也不来了', e: '💔' }, { t: '主角说的谎被发现了', e: '🙊' }, { t: '答应过的事被忘了', e: '📅' },
      { t: '伙伴一声不响地离开了', e: '🚪' }, { t: '收到一封被退回来的信', e: '💌' }, { t: '有人终于说出了真心话', e: '💬' },
      { t: '一直等的人没有来', e: '⏳' }, { t: '大家把责任推给了主角', e: '👥' }, { t: '道歉的话卡在喉咙里', e: '😔' },
      { t: '约定好的日子提前到了', e: '🎈' }, { t: '有人替主角挨了骂', e: '🫂' }, { t: '最喜欢的东西被送走了', e: '🎁' },
      { t: '主角发现自己错了', e: '🪞' }, { t: '有人一直在暗处帮忙', e: '🕯️' }, { t: '主角的名字被人顶替了', e: '📛' },
      { t: '最珍贵的东西被弄坏了', e: '🏺' }, { t: '说好的冒险被取消了', e: '🗺️' }, { t: '朋友为救主角受了伤', e: '🩹' },
      { t: '主角必须选择留下谁', e: '⚖️' }, { t: '突然有人叫了主角的小名', e: '📣' },
    ],
  },
  {
    key: 'other', name: '道具', emoji: '🎁', required: false,
    hint: '(可选)身上带着什么特别的东西?',
    cards: [
      { t: '会发光的石头', e: '💎' }, { t: '一把会说话的伞', e: '☂️' }, { t: '一本写不完的日记', e: '📔' },
      { t: '半个指南针', e: '🧭' }, { t: '装得下海的瓶子', e: '🍾' }, { t: '一枚旧硬币', e: '🪙' },
      { t: '会变大的口袋', e: '👜' }, { t: '一张会改的地图', e: '🗺️' }, { t: '断了线的风筝', e: '🪁' },
      { t: '会融化的项链', e: '📿' }, { t: '一把旧钥匙', e: '🗝️' }, { t: '会唱歌的贝壳', e: '🐚' },
      { t: '只有一半的照片', e: '🖼️' }, { t: '会结果的铅笔', e: '✏️' }, { t: '一盏不会灭的灯', e: '🏮' },
      { t: '会写字的羽毛', e: '🪶' }, { t: '一双不合脚的鞋', e: '👞' }, { t: '会传话的纸飞机', e: '✈️' },
      { t: '能听见心跳的鼓', e: '🥁' }, { t: '会下雪的水晶球', e: '🔮' }, { t: '一只空鸟笼', e: '🕊️' },
      { t: '会缝补的针线', e: '🧵' }, { t: '一封没寄出的信', e: '💌' }, { t: '会走的闹钟', e: '⏰' },
      { t: '半根蜡烛', e: '🕯️' }, { t: '会开花的帽子', e: '👒' }, { t: '能装梦的罐子', e: '🫙' },
      { t: '会变形的积木', e: '🧱' }, { t: '一枚会滚的纽扣', e: '🧷' }, { t: '会说话的树苗', e: '🌳' },
      { t: '装满声音的盒子', e: '📦' }, { t: '一只断掉的铅笔', e: '🖍️' }, { t: '会发芽的书', e: '📖' },
      { t: '一块补过的手帕', e: '🧻' }, { t: '会飘的纸船', e: '⛵' }, { t: '一枚别针', e: '📎' },
      { t: '会生气的闹钟', e: '⏱️' }, { t: '能听见秘密的听筒', e: '🎧' }, { t: '会迷路的地毯', e: '🧶' },
      { t: '一直热着的汤', e: '🥣' }, { t: '会自己写字的黑板', e: '📝' }, { t: '会笑的门铃', e: '🔔' },
      { t: '会变色的雨靴', e: '🥾' }, { t: '会做梦的枕头', e: '🛏️' }, { t: '会等你的秋千', e: '🪝' },
      { t: '会数数的算盘', e: '🧮' }, { t: '会跑的鞋带', e: '👟' }, { t: '会唱歌的锅', e: '🍲' },
      { t: '会画画的雨水', e: '🌧️' }, { t: '一枚永远温热的糖', e: '🍬' },
    ],
  },
];

/* ---------- 画风库:按故事内容推荐(第 4 幕"定画风") ---------- */
const STYLE_LIB = [
  { name: '蜡笔涂鸦', e: '🖍️', desc: '像小朋友画的,线条歪歪的,颜色很亮', kw: ['小', '孩子', '玩', '笑', '家', '学校', '朋友', '糖', '快乐', '海'] },
  { name: '水彩晕染', e: '🎨', desc: '颜色像水一样化开,软软的、安静的', kw: ['云', '雨', '梦', '温柔', '轻轻', '安静', '花', '月', '思念', '回家'] },
  { name: '厚涂动画', e: '🖌️', desc: '颜色厚厚一层,像电影动画,很有力量', kw: ['冒险', '勇气', '奔跑', '飞', '战斗', '出发', '追寻', '英雄', '光'] },
  { name: '剪纸拼贴', e: '✂️', desc: '像用彩纸剪出来贴上去的,一层一层', kw: ['小', '手工', '口袋', '剪刀', '纸', '礼', '邮', '旧', '信件', '收藏'] },
  { name: '像素复古', e: '🕹️', desc: '一格一格的小方块,像老游戏机', kw: ['机器', '程序', '游戏', '齿轮', '时钟', '科学', '数字', '机械', '修'] },
  { name: '国风水墨', e: '🀄', desc: '墨色淡淡的,留白很多,像中国画', kw: ['古', '树', '山', '诗', '墨', '船', '桥', '雨', '月', '传说'] },
  { name: '黏土定格', e: '🧱', desc: '像橡皮泥捏的,圆圆的、能摸到手感', kw: ['食物', '可爱', '软', '熊', '餐', '面包', '汤', '圆', '胖', '摸'] },
  { name: '霓虹赛博', e: '🌃', desc: '夜里发光的城市,紫蓝霓虹灯', kw: ['夜', '灯', '城市', '未来', '赛博', '雨夜', '巷', '霓虹', '飞车', '星'] },
  { name: '3D 立体绘本', e: '🧸', desc: '像立体书里的玩偶,毛茸茸圆滚滚', kw: ['熊', '兔', '玩偶', '抱', '家', '温暖', '睡', '抱抱', '小'] },
  { name: '马卡龙软糖', e: '🍬', desc: '粉粉嫩嫩的马卡龙色,甜到冒泡', kw: ['糖', '甜', '糕', '点', '彩虹', '粉', '可爱', '派对', '蛋糕'] },
  { name: '铅笔速写', e: '✏️', desc: '像本子上随手画的素描,有铅笔灰', kw: ['写', '本子', '记', '秘密', '日记', '画', '学', '考'] },
  { name: '版画印染', e: '🟦', desc: '深蓝底色配白色线条,像印章印的', kw: ['海', '鲸', '船', '鱼', '浪', '岛', '远行', '捕', '航'] },
];

/* 依据故事文本给出推荐画风(命中的关键词越多越靠前,不足补默认) */
function recommendStyles(text, n) {
  const t = String(text || '');
  const scored = STYLE_LIB.map(s => {
    const hit = s.kw.filter(k => t.includes(k));
    return { name: s.name, e: s.e, desc: s.desc, hit, score: hit.length };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter(x => x.score > 0).slice(0, n || 3);
  for (const s of scored) {
    if (top.length >= (n || 3)) break;
    if (!top.some(x => x.name === s.name)) top.push(s);
  }
  return top.slice(0, n || 3);
}

/* ============================================================
   脑洞放映厅 · 主逻辑(v3 槽位版 · 纯离线,不含任何 API 调用)
   六步:① 抽脑洞卡 → ② 讲想法 → ③ 写剧本 → ④ 定画风 → ⑤ 画分镜 → ⑥ 首映礼
   作品只存本机;影片用浏览器自带录制能力生成(不需要联网)
   ============================================================ */

/* ---------------- 全局状态 ---------------- */
const G = {
  stage: 'title',        // title / card / idea / story / style / board / prem
  director: '小导演', intern: '小映',
  slots: [],                                          // [{key,name,emoji,required,custom,pool:[{t,e}],card:{t,e}|null}]
  idea: '', story: '', storyDraft: '', style: '', stylePicked: false,
  panels: [], panelsFrom: '', filmIdx: 0, title: '', refl: ['', ''], statement: '',
  log: [], replayId: '', videoUrl: '', filmMs: 0, filmSeconds: 0, videoSegments: {}, aiShots: 0,
  wrongOn: false, capWarned: false,
};

/* ---------------- 小工具 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const store = {
  _m: {},
  _warned: false,
  get(k) { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch (e) { return this._m[k]; } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      /* 本机存储满了(草稿里有 AI 图时很常见):先把值留在内存,并且**明确告诉用户**,
         否则刷新一下作品就悄悄没了 */
      this._m[k] = v;
      if (!this._warned) {
        this._warned = true;
        try { toast('⚠️ 本机存储满了,这次改动只留在内存里,刷新会丢。先「装订成册」存档或清一下本机数据吧', 6000); } catch (e2) {}
      }
      return false;
    }
  },
};
let toastTimer = null;
function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2600);
}
function lg(kind, txt) {
  G.log.push({ t: new Date().toTimeString().slice(0, 5), kind, txt: String(txt).slice(0, 80) });
  if (G.log.length > 200) G.log.shift();
}

/* ---------------- 步骤条与屏幕 ---------------- */
const internName = () => ((G && G.intern) || '小映');
const STEPS = { card: 1, idea: 2, story: 3, style: 4, board: 5, prem: 6 };
function screenId(stage) { return 'sc-' + stage; }
/* 导航原因:引擎在"开拍新片"这种需要重置返回栈的时候把它传给 React 层 */
let navReason = '';
function show(stage) {
  if (stage !== 'prem') { stopAuto(); stopSpeak(); }   /* 离开首映礼就别再自动翻页/念台词 */
  G.stage = stage;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === screenId(stage)));
  renderCreationGuide(stage);
  refreshStepbar();
  syncDownstreamNotes();
  saveDraft();
  root.querySelector('.app-viewport')?.scrollTo({ top: 0, behavior: 'instant' });
  onNavigate(stage, navReason || undefined);
  navReason = '';
}
function renderCreationGuide(stage) {
  const box = $('#creation-guide');
  if (!box) return;
  box.classList.toggle('hidden', stage === 'title');
  if (stage === 'title') return;
  const guide = creationGuide(stage, G);
  const title = $('#creation-guide-title'), prompt = $('#creation-guide-prompt'), privacy = $('#creation-guide-privacy');
  if (title) title.textContent = guide.title;
  if (prompt) prompt.textContent = guide.prompt;
  if (privacy) privacy.textContent = '🔒 ' + guide.privacyHint;
}
function refreshStepbar() {
  const bar = $('#stepbar');
  if (bar) bar.classList.toggle('hidden', G.stage === 'title');   /* 首页不显示步骤条 */
  $$('#stepbar .step').forEach(el => {
    const n = +el.getAttribute('data-step');
    const cur = STEPS[G.stage] || 0;
    el.classList.toggle('cur', n === cur);
    el.classList.toggle('now', n === cur);
    el.classList.toggle('done', n < cur);
    const reachable = n === cur || stepHasContent(n);
    el.classList.toggle('locked', !reachable);
    el.setAttribute('aria-current', n === cur ? 'step' : 'false');
    el.setAttribute('aria-disabled', String(!reachable));
    el.style.cursor = reachable ? 'pointer' : 'default';
    el.title = reachable ? '点这里跳到第 ' + n + ' 步' : '这一步还没内容';
  });
}
function stepHasContent(n) {
  if (n === 1) return true;
  if (n === 2) return requiredCardsDone();
  if (n === 3) return !!(G.story || '').trim();
  if (n === 4) return !!G.style;
  if (n === 5) return G.panels.length > 0;
  if (n === 6) return G.panels.length > 0;
  return false;
}
function jumpTo(n) {
  if (!stepHasContent(n)) { toast('这一步还没有内容,先按顺序来'); return false; }
  const map = { 1: 'card', 2: 'idea', 3: 'story', 4: 'style', 5: 'board', 6: 'prem' };
  const st = map[n];
  if (n === 1) renderSlots();          /* 以前跳回第 1 步不重画卡格子,页面会是空的 */
  if (n === 2) renderIdea();
  if (n === 3) renderStory();
  if (n === 4) renderStyle();
  if (n === 5) { if (!G.panels.length) initPanels(); renderBoard(); }
  if (n === 6) { G.filmIdx = 0; renderPrem(); }
  show(st);
  toast('已跳到第 ' + n + ' 步:后面的内容都给你留着');
  return true;
}
const STALE_MSG = {
  story: '你改了想法或卡片,下面这份剧本还是旧的——要重写就点「重新整理草稿」,不想改就接着用。',
  prem: '你改了前面的内容,分镜和影片还是旧的——想同步就回第 5 步重画,不想改就接着用。',
};
function syncDownstreamNotes() {
  const a = $('#stale-story'), b = $('#stale-prem');
  if (a) { const on = !!(G.story) && G.storyStale; a.textContent = on ? '⚠️ ' + STALE_MSG.story : ''; a.classList.toggle('hidden', !on); }
  if (b) { const on = G.panels.length && G.panelsStale; b.textContent = on ? '⚠️ ' + STALE_MSG.prem : ''; b.classList.toggle('hidden', !on); }
}

/* ---------------- 位置 1:抽脑洞卡 ---------------- */
function myCards() {                     /* 孩子自己写的卡:{ key: [{t,e}] } */
  const m = store.get('bh_mycards');
  return (m && typeof m === 'object') ? m : {};
}
function saveMyCards(m) { store.set('bh_mycards', m); }
function myCount(s) {
  return s.pool.filter(c => c.mine).length;
}
function initSlots() {
  const mine = myCards();
  G.slots = SLOT_DEFS.map(d => {
    const pool = d.cards.slice();
    (mine[d.key] || []).forEach(c => { if (!pool.some(x => x.t === c.t)) pool.push({ t: c.t, e: c.e, mine: true }); });
    return {
      key: d.key, name: d.name, emoji: d.emoji, required: !!d.required,
      custom: false, pool, card: null, hint: d.hint,
    };
  });
  G.customSeq = 0;
}
function requiredCardsDone() {
  return G.slots.filter(s => s.required).every(s => s.card);
}
/* 卡片或想法一变,已经写好的剧本就旧了 —— 标出来提醒导演(以前这个提示永远不会出现) */
function markStoryStale() {
  if ((G.story || '').trim()) G.storyStale = true;
}
function renderSlots() {
  const grid = $('#slot-grid');
  grid.innerHTML = G.slots.map((s, i) => {
    const card = s.card;
    return `<article class="slotcard ${card ? 'has' : ''} ${s.required ? 'req' : ''}" data-i="${i}">
      <div class="slot-head" data-drag="slot" title="按住格子名拖动,整个格子连卡一起挪位置">
        <span class="slot-name">${s.emoji} ${esc(s.name)}</span>
        <span class="slot-tags">
          ${s.required ? '<i class="reqtag">必抽</i>' : '<i class="opttag">可选</i>'}
          ${s.custom ? `<button class="btn btn-mini slot-del" data-act="delslot" title="删掉这个格子">✖</button>` : ''}
        </span>
      </div>
      <div class="slot-card"${card ? ' data-drag="card" title="长按这张卡拖到别的格子,松手就换位置"' : ''}>
        ${card ? `<span class="slot-emoji">${card.e}</span><b>${esc(card.t)}</b>` : `<span class="slot-empty">${esc(s.hint || '还没抽卡')}</span>`}
        ${(!s.required && card) ? `<button class="slot-x" data-act="clearcard" title="不要这张卡">✖</button>` : ''}
      </div>
      <div class="slot-acts">
        <button class="btn btn-mini" data-act="draw">${card ? '🔄 换一张' : '🎲 抽一张'}</button>
        <button class="btn btn-mini" data-act="write">✏️ 自己写</button>
      </div>
      <div class="slot-pool">卡池 ${s.pool.length} 张${myCount(s) ? '(你加了 ' + myCount(s) + ' 张)' : ''}</div>
    </article>`;
  }).join('');
}
function slotsChanged() {                 /* 卡片有任何改动:重画 + 存草稿 + 提醒剧本该更新了 */
  markStoryStale();
  renderSlots();
  saveDraft();
}
function drawSlot(i) {
  const s = G.slots[i];
  if (!s.pool || !s.pool.length) { toast('这个格子还没有卡池,点「✏️ 自己写」给自己写一张吧'); return; }
  let c = pick(s.pool), tries = 0;
  while (s.card && c.t === s.card.t && tries++ < 8) c = pick(s.pool);
  s.card = { t: c.t, e: c.e };
  lg('card', '抽到「' + s.name + '」:' + c.t);
  slotsChanged();
}
function writeSlot(i) {
  const s = G.slots[i];
  const t = prompt('给「' + s.name + '」写一张卡(不超过 16 个字,会存进卡池,以后还能抽到)', s.card ? s.card.t : '');
  if (t === null) return;
  const v = String(t).trim().slice(0, 16);
  if (!v) { toast('什么都没写哦'); return; }
  let mine = false;
  if (!s.pool.some(c => c.t === v)) {              /* 自己的卡进池子,以后还能被抽到 */
    s.pool.push({ t: v, e: s.emoji, mine: true });
    mine = true;
    if (!s.custom) {
      const all = myCards();
      all[s.key] = all[s.key] || [];
      if (!all[s.key].some(c => c.t === v)) all[s.key].push({ t: v, e: s.emoji });
      saveMyCards(all);
    }
  }
  s.card = { t: v, e: s.emoji };
  lg('card', '自己写了「' + s.name + '」:' + v);
  toast(mine ? '✅ 已用上,并存进「' + s.name + '」的卡池(现在 ' + s.pool.length + ' 张)' : '✅ 用上了');
  slotsChanged();
}
function clearSlotCard(i) {                  /* 可选格:这张卡不要了 */
  const s = G.slots[i];
  if (s.required) { toast('主角、场景、经过是必抽的,不能空着——可以「换一张」'); return; }
  if (!s.card) return;
  lg('card', '把「' + s.name + '」的卡拿掉了:' + s.card.t);
  s.card = null;
  slotsChanged();
  toast('已拿掉这张卡(卡池里还在,想用再抽回来)');
}
function dropCard(from, to) {                 /* 长按拖卡片:空位搬过去,有卡就互换 */
  const r = moveCard(G.slots, from, to);
  if (!r) return;
  lg('card', r.kind === 'swap'
    ? '把「' + r.from + '」的卡和「' + r.to + '」的卡换了位置'
    : '把「' + r.card + '」从「' + r.from + '」搬到了「' + r.to + '」');
  slotsChanged();
  toast(r.kind === 'swap'
    ? '🔀 换好了:' + r.from + ' = ' + r.card + ',' + r.to + ' = ' + r.displaced
    : '✅ 「' + r.card + '」搬到「' + r.to + '」了');
}
function dropSlot(from, to) {                 /* 长按拖格子:整格连卡一起挪位置 */
  const r = reorderSlot(G.slots, from, to);
  if (!r) return;
  lg('card', '把「' + r.name + '」整个格子挪到了第 ' + r.position + ' 位');
  slotsChanged();
  toast('↕ 「' + r.name + '」挪到了第 ' + r.position + ' 位');
}
function addSlot() {
  const name = prompt('新格子叫什么?(比如:宝物 / 天气 / 一句话)');
  if (name === null) return;
  const v = String(name).trim().slice(0, 8);
  if (!v) { toast('没填名字'); return; }
  if (G.slots.some(s => s.name === v)) { toast('已经有这个格子了'); return; }
  G.slots.push({ key: 'custom' + (++G.customSeq || 1), name: v, emoji: '🧩', required: false, custom: true, pool: [], card: null, hint: '抽不到就自己写' });
  lg('card', '加了一个新格子:' + v);
  slotsChanged();
}
function drawAll() {
  G.slots.forEach((s, i) => { if (!s.card) drawSlot(i); });
  toast('全部抽好了!缺哪格点「换一张」');
}
function clearAll() {
  if (!confirm('把所有格子都清空重抽?')) return;
  G.slots.forEach(s => { s.card = null; });
  slotsChanged();
}

/* ---------------- 位置 2:讲想法 ---------------- */
function cardOf(key) { const s = G.slots.find(x => x.key === key); return s && s.card ? s.card.t : ''; }
function synopsisText() {
  const hero = cardOf('hero') || '(还没抽主角)', scene = cardOf('scene') || '(还没抽场景)', plot = cardOf('plot') || '(还没抽经过)';
  const side = cardOf('side'), turn = cardOf('turn'), other = cardOf('other');
  let s = '有一个' + hero + ',住在' + scene + '。有一天,' + hero + plot + '。';
  if (side) s += '好在' + side + '一直陪着它。';
  if (other) s += '它们还带上了' + other + '。';
  if (turn) s += '可是没想到,' + turn + '。';
  const more = G.slots.filter(x => x.custom && x.card).map(x => x.name + '是' + x.card.t);
  if (more.length) s += '对了,' + more.join('、') + '。';
  return s;
}
function renderIdea() {
  const syn = G.synopsis || synopsisText();
  const box = $('#idea-synopsis');
  box.textContent = syn;
  box.classList.toggle('ai-syn', !!G.synopsis);
  $('#ta-idea').value = G.idea || '';
  const tag = $('#idea-syn-tag');
  if (tag) tag.textContent = G.synopsis ? ('✍️ AI 写的 · 可点「🔁 换一版」') : '程序先拼了一版——点「✨ 让 AI 把简介写通顺」';
}
function ideaToStoryDraft() {
  const syn = synopsisText();
  const detail = ($('#ta-idea').value || '').trim();
  G.idea = detail;
  const parts = [];
  parts.push(syn);
  if (detail) {
    /* 离线:把导演补充的话按句子切开,一行一页,一个字都不编 */
    const sentences = detail.split(/(?<=[。！？；;!\n])/).map(x => x.replace(/^[\s,，、]+/, '').trim()).filter(Boolean);
    sentences.forEach(s2 => parts.push(s2));
  }
  G.storyDraft = parts.join('\n');
  G.story = G.storyDraft;
  G.storyStale = false;
  lg('story', '整理出剧本草稿:' + parts.length + ' 行');
  return parts;
}
function renderStory() {
  $('#ta-story').value = G.story || G.storyDraft || '';
  $('#bub-story').innerHTML = '🤖 ' + esc(G.intern) + ':这是我照着你的简介和补充写的剧本草稿——<b>每一行就是一页分镜</b>,不满意直接改,你才是导演。' +
    '<br><small>现在是离线草稿模式:只按你说的顺序整理,没有替你编情节。接入写剧本的大模型后,这里会变成真正连贯的剧本。</small>';
  $('#story-hint').textContent = (G.story || '').split('\n').filter(Boolean).length + ' 页';
}

/* ---------------- 位置 4:定画风 ---------------- */
function renderStyle() {
  const text = (G.synopsis || synopsisText()) + ' ' + (G.idea || '') + ' ' + (G.story || '');
  const recos = recommendStyles(text, 6);          /* 第 1 个最推荐 + 后面 5 个备选 */
  const best = recos[0] || { name: '儿童绘本', e: '🎨', desc: '' };
  const others = recos.slice(1, 6);
  const bub = $('#style-bubble');
  if (bub) bub.innerHTML = '🤖 ' + esc(internName()) + ':我看了一遍你的故事,先挑了一个最搭的;不喜欢就换下面的,或者自己写一种。';
  const why = (best.hit && best.hit.length)
    ? '你的故事里有「' + best.hit.slice(0, 3).join('、') + '」,和它最搭'
    : '和你这个故事的气质最搭';
  $('#style-recos').innerHTML =
    '<article class="pickbest' + (G.style === best.name ? ' sel' : '') + '" data-style="' + esc(best.name) + '" data-act="usepick">' +
      '<div class="pb-emoji">' + best.e + '</div>' +
      '<div class="pb-body">' +
        '<div class="pb-tag">⭐ AI 最推荐</div>' +
        '<div class="pb-name">' + esc(best.name) + '</div>' +
        '<div class="pb-desc">' + esc(best.desc || '') + '</div>' +
        '<div class="pb-why">' + esc(why) + '</div>' +
      '</div>' +
      '<div class="pb-go">' + (G.style === best.name ? '✅ 已选中' : '就用它 →') + '</div>' +
    '</article>' +
    '<div class="pickrow">' + others.map(r =>
      '<button class="pickmini' + (G.style === r.name ? ' sel' : '') + '" data-style="' + esc(r.name) + '" data-act="usepick" title="' + esc(r.desc || '') + '">' +
        '<span class="pm-emoji">' + r.e + '</span><span class="pm-name">' + esc(r.name) + '</span>' +
      '</button>').join('') + '</div>';
  $('#in-style-custom').value = G.stylePicked && !recos.some(r => r.name === G.style) ? G.style : '';
  const msg = $('#style-msg');
  if (msg) msg.textContent = G.style ? ('✅ 就用「' + G.style + '」来画,可以点「开始画分镜」了') : '选一个你喜欢的(点一下就行),或者自己写一种。';
  $('#btn-style2board').disabled = !G.style;
}
function chooseStyle(name) {
  const v = String(name || '').trim().slice(0, 20);
  if (v === G.style) {                       /* 重重点同一个画风:别把画好的分镜清掉 */
    G.stylePicked = true;
    toast('🎨 还是「' + v + '」,分镜都给你留着');
    renderStyle(); saveDraft();
    return;
  }
  G.style = v;
  G.stylePicked = true;
  lg('style', '定了画风:' + v);
  toast('🎨 画风定为「' + v + '」');
  G.panels = []; G.panelsFrom = ''; G.panelsStale = false; G.videoSegments = {};   // 换画风 → 分镜要重画(但草稿仍保留剧本)
  renderStyle(); saveDraft();
}

/* ---------------- 位置 5:画分镜 ---------------- */
function initPanels() {
  const story = G.story || '';
  /* 剧本没变就保留孩子已经画好、加好、删好的格子(用剧本快照比对,不靠行数) */
  if (G.panels.length && G.panelsFrom === story) return;
  const caps = story.split('\n').map(x => x.trim()).filter(Boolean);
  const list = caps.length ? caps : ['(还没有剧本)'];
  G.panels = list.map((cap, i) => ({
    cap, prm: '', seed: (i + 1) * 977, version: 0, wrong: null, note: '', fix: '',
    accepted: false, svg: '', img: '', thumb: '', aiMsg: '', aiDrawn: false,
  }));
  G.panelsFrom = story;
  G.videoSegments = {};                 /* 分镜变了,之前拍好的镜头就作废,免得拼进旧内容 */
  lg('panel', '生成了 ' + G.panels.length + ' 页分镜(等孩子来画)');
}
/* 画风 → 调色 */
function paletteFor(text) {
  const t = (text || '') + ' ' + (G.style || '');
  const rules = [
    { kw: ['海底', '深', '水', '游', '鲸', '海'], bg: ['#0e5aa7', '#1d8ac9'], deco: 'bubbles' },
    { kw: ['云', '天', '飞', '风', '雨'], bg: ['#7ec8f7', '#e8f6ff'], deco: 'cloud' },
    { kw: ['太空', '宇宙', '星', '月', '夜', '霓虹'], bg: ['#171240', '#3a2a7a'], deco: 'stars' },
    { kw: ['森林', '树', '花', '草', '园'], bg: ['#7fd18a', '#e4f7d3'], deco: 'leaves' },
    { kw: ['雪', '冰', '冬', '冷'], bg: ['#dfeffa', '#f6fbff'], deco: 'snow' },
    { kw: ['沙漠', '沙', '黄'], bg: ['#f2c464', '#fde7b2'], deco: 'sun' },
    { kw: ['火', '热', '红'], bg: ['#f79b72', '#ffe0c2'], deco: 'sparkle' },
    { kw: ['纸', '信', '旧', '书'], bg: ['#f6e7c8', '#fffaf0'], deco: 'sparkle' },
  ];
  for (const r of rules) if (r.kw.some(k => t.includes(k))) return r;
  return { bg: ['#c9b6ff', '#f3ecff'], deco: 'sparkle' };
}
function emojisOf() {
  const out = [];
  G.slots.forEach(s => { if (s.card) out.push(s.card.e); });
  return out.length ? out : ['🎬'];
}
function buildSVG(p, i) {
  const pal = paletteFor(p.cap + ' ' + p.prm);
  const [c1, c2] = pal.bg;
  const es = emojisOf();
  const main = es[0] || '🎬', second = es[1] || '', third = es[2] || '';
  const wrong = !!p.wrong;
  const deco = pal.deco || 'sparkle';
  const decoHtml = {
    bubbles: '<circle cx="120" cy="120" r="16" fill="#fff" opacity=".35"/><circle cx="480" cy="90" r="22" fill="#fff" opacity=".28"/><circle cx="560" cy="300" r="14" fill="#fff" opacity=".3"/>',
    cloud: '<ellipse cx="200" cy="100" rx="70" ry="34" fill="#fff" opacity=".6"/><ellipse cx="520" cy="140" rx="56" ry="28" fill="#fff" opacity=".5"/>',
    stars: '<circle cx="120" cy="90" r="4" fill="#fff"/><circle cx="500" cy="70" r="5" fill="#fff"/><circle cx="300" cy="60" r="3" fill="#fff"/><circle cx="580" cy="180" r="4" fill="#fff"/>',
    leaves: '<path d="M100 320 q30 -50 60 0 q-30 20 -60 0" fill="#2f9e44" opacity=".55"/><path d="M520 300 q28 -46 56 0 q-28 18 -56 0" fill="#2f9e44" opacity=".45"/>',
    snow: '<circle cx="140" cy="110" r="6" fill="#fff"/><circle cx="420" cy="80" r="5" fill="#fff"/><circle cx="540" cy="250" r="7" fill="#fff"/>',
    sun: '<circle cx="530" cy="90" r="42" fill="#ffe066" opacity=".9"/>',
    sparkle: '<path d="M540 120 l10 24 l24 10 l-24 10 l-10 24 l-10 -24 l-24 -10 l24 -10 z" fill="#fff" opacity=".7"/>',
  }[deco] || '';
  const wrongBadge = wrong ? `<g><rect x="24" y="24" rx="14" width="250" height="52" fill="#e17055" opacity=".92"/><text x="46" y="58" font-size="26" fill="#fff" font-family="sans-serif">💥 画错啦!(v${p.version})</text></g>` : '';
  const styleTag = `<text x="612" y="378" text-anchor="end" font-size="20" fill="#ffffff" opacity=".85" font-family="sans-serif">${esc(G.style || '')} · v${p.version}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" style="width:100%;height:100%;display:block">
    <defs><linearGradient id="sky${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="640" height="400" fill="url(#sky${i})"/>
    ${decoHtml}
    <text x="320" y="215" text-anchor="middle" font-size="150">${wrong ? '❓' : main}</text>
    <text x="105" y="235" text-anchor="middle" font-size="70">${second}</text>
    <text x="540" y="235" text-anchor="middle" font-size="70">${third}</text>
    <text x="320" y="330" text-anchor="middle" font-size="24" fill="#ffffff" opacity=".92" font-family="sans-serif">${esc(p.cap || '').slice(0, 22)}</text>
    ${styleTag}${wrongBadge}
  </svg>`;
}
/* 离线画师:提示词太糊 → "翻车"(教学点:AI 会一本正经地理解错) */
function paintPanel(p, i) {
  p.version++;
  const prm = (p.prm || '').trim();
  const vague = prm.length > 0 && prm.length < 6;
  const empty = !prm;
  p.wrong = null; p.note = ''; p.fix = '';
  if (G.wrongOn && (empty || vague) && !p.accepted) {
    /* 教学点:提示词说不清,小映一定会理解偏(不随机,孩子才能学会"改提示词→画对") */
    p.wrong = empty ? '提示词是空的,' + internName() + '只能瞎猜' : '提示词太短,' + internName() + '理解偏了';
    p.note = '我把「' + (p.cap || '').slice(0, 12) + '」画成了别的东西……';
    p.fix = '在下面的提示词里写清楚:画面里有谁、在哪里、在做什么(写具体了就不会画错)';
  } else if (G.wrongOn && !empty) {
    p.note = internName() + ':这次明白多了!';
  }
  p.svg = buildSVG(p, i);
  return p.svg;
}
function renderBoard() {
  const tip = $('#board-tip');
  const nm = internName();
tip.innerHTML = '<b>💡 分镜台口诀:</b>每一格 = 台词 + 给' + nm + '的"画面提示词"。' +
    '<br><span style="color:#8b7fb8">画得不满意?那是提示词没说清——写清"谁/在哪/在做什么",再点「🖼️ AI 画这格」。</span>' +
    '<br><span style="color:#8b7fb8">本片画风:</span> <b>' + esc(G.style || '(未定)') + '</b>';
  renderPanels();
}
function renderPanels() {
  $('#panel-grid').innerHTML = G.panels.map((p, i) => {
    const hasArt = !!(p.img || p.svg);
    const chip = !hasArt ? '<span class="pchip wait">✏️ 等你创作</span>'
      : p.img ? '<span class="pchip ok">🎨 AI 画的</span>'
        : p.wrong ? '<span class="pchip wrong">⚠️ 画错啦</span>'
          : p.accepted ? '<span class="pchip ok">✅ 已通过 v' + p.version + '</span>'
            : '<span class="pchip">🖌️ v' + p.version + '</span>';
    const art = hasArt
      ? '<div class="svgbox">' + (p.svg || '') + '</div>'
      : '<div class="svgbox empty">' +
          '<div class="empty-emoji">🎬</div>' +
          '<div class="empty-text">等待你创作</div>' +
          '<div class="empty-sub">写一句画面提示词,再点「🖼️ AI 画这格」</div>' +
        '</div>';
    const note = (p.wrong || p.note) ? '<div class="boardtip">🤖 ' + esc(internName()) + ':' + esc(p.note || p.wrong) + (p.fix ? '<br><b>💡 ' + esc(p.fix) + '</b>' : '') + '</div>' : '';
    return '<article class="panel" data-i="' + i + '">' +
      '<div class="panel-head"><span class="panel-num">🎞️ 第 ' + (i + 1) + ' 格</span>' + chip + '</div>' +
      art + note +
      '<label>📝 这一页的台词 / 旁白</label>' +
      '<textarea class="cap" rows="2" maxlength="120" placeholder="这一格发生了什么事?">' + esc(p.cap) + '</textarea>' +
      '<label>🎨 画面提示词(写清谁、在哪、在做什么)</label>' +
      '<textarea class="prm" rows="2" placeholder="例:圆滚滚的蓝色小鲸鱼在海底理发店门口,水泡慢慢上浮">' + esc(p.prm || '') + '</textarea>' +
      '<div class="panel-actions">' +
        '<button class="btn btn-mini act-polish">✨ 帮我把提示词写具体</button>' +
        '<button class="btn btn-mini act-aipaint">🖼️ AI 画这格</button>' +
        '<button class="btn btn-mini act-accept' + (p.accepted ? ' btn-primary' : '') + '">' + (p.accepted ? '✅ 已通过(点此撤回)' : '✅ 这版通过') + '</button>' +
        '<button class="btn btn-mini act-paint">🎨 重画这格</button>' +
      '</div>' +
    '</article>';
  }).join('');
}
function addPanel() {
  if (G.panels.length >= 10) { toast('最多 10 格,够啦!'); return; }
  G.panels.push({ cap: '', prm: '', seed: rnd(9999), version: 0, wrong: null, note: '', fix: '', accepted: false, svg: '', img: '', aiMsg: '' });
  renderPanels();
}
function delPanel() { if (G.panels.length <= 2) { toast('至少留 2 格'); return; } G.panels.pop(); renderPanels(); }

/* ---------------- 位置 6:首映礼 ---------------- */
function renderPrem() {
  if (!$('#in-title').value && G.title) $('#in-title').value = G.title;
  $('#ta-r1').value = G.refl[0] || '';
  $('#ta-r2').value = G.refl[1] || '';
  $('#ta-statement').value = G.statement || '';
  G.filmIdx = Math.min(G.filmIdx, G.panels.length);
  renderFilm();
  renderPlayer();
  renderLog();
}
function pageCover() {
  return `<div class="page page-cover">
    <div class="cv-emoji">🎬</div>
    <div class="cv-title">《${esc(G.title || '还没起名字')}》</div>
    <div class="cv-meta">导演 ${esc(G.director)} · AI 实习生 ${esc(G.intern)}<br>${esc(synopsisText())}</div>
    <div class="cv-meta">画风:${esc(G.style || '')}</div>
  </div>`;
}
/* 一页的画面:优先用 AI 真正画出来的那张图(存档里是缩小版),没有才退回程序化插画,再没有就给占位 */
function pageArt(p) {
  const pic = (p && (p.img || p.thumb)) || '';
  if (pic) {
    const label = p.img ? '🎨 AI 画的' : '🎨 AI 画的(存档缩略图)';
    return '<div class="svgbox"><img src="' + esc(pic) + '" alt="AI 画面">' +
      '<span class="ai-pic">' + label + '</span></div>';
  }
  if (p && p.svg) return '<div class="svgbox">' + p.svg + '</div>';
  return '<div class="svgbox empty">' +
    '<div class="empty-emoji">🎬</div>' +
    '<div class="empty-text">这一页还没有画面</div>' +
    '<div class="empty-sub">回第 5 步画一下,或点「🖼️ AI 画这格」</div>' +
  '</div>';
}
function pagePanel(p, i) {
  return `<div class="page">
    ${pageArt(p)}
    <div class="page-caption">🎞️ 第 ${i + 1} 页 · ${esc(p.cap || '……')}</div>
  </div>`;
}
/* 自动翻页的定时器:只允许一个,手动翻页或离开页面就停 */
let AUTO = null;
function stopAuto() {
  if (AUTO) { clearInterval(AUTO); AUTO = null; }
  const b = $('#btn-auto');
  if (b) b.textContent = '▶️ 自动翻页';
}
function toggleAuto() {
  if (AUTO) { stopAuto(); toast('⏸ 自动翻页停了'); return; }
  goPage(0);
  const b = $('#btn-auto');
  if (b) b.textContent = '⏸ 停止翻页';
  AUTO = setInterval(() => {
    if (G.filmIdx >= G.panels.length) { stopAuto(); return; }   /* 放到最后一面就停,不来回绕 */
    goPage(G.filmIdx + 1);
  }, 2600);
  toast('▶️ 自动翻页中(再点一下就停)');
}
function renderFilm() {
  const film = $('#film');
  if (!film) return;
  film.innerHTML = [pageCover()].concat(G.panels.map(pagePanel)).join('');
  renderStrip();
  showPageInFilm();
}
/* 只切"当前显示哪一面",不重建 DOM —— 翻页时不再重新解码所有图片 */
function showPageInFilm() {
  const film = $('#film');
  if (!film) return;
  G.filmIdx = Math.max(0, Math.min(G.panels.length, G.filmIdx || 0));
  const all = film.children;
  for (let i = 0; i < all.length; i++) all[i].style.display = i === G.filmIdx ? 'flex' : 'none';
  const pos = $('#film-pos'); if (pos) pos.textContent = (G.filmIdx + 1) + ' / ' + all.length;
  $$('#filmstrip .thumb').forEach((t, i) => t.classList.toggle('cur', i === G.filmIdx));
  const cur = $('#filmstrip .thumb.cur');
  if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
}
function renderStrip() {
  const strip = $('#filmstrip'); if (!strip) return;
  const thumbOf = p => {
    const pic = p && (p.img || p.thumb);
    if (pic) return '<img src="' + esc(pic) + '" alt="">';
    if (p && p.svg) return p.svg;
    return '<div style="font-size:22px;text-align:center;padding:14px 0">🎬</div>';
  };
  strip.innerHTML = `<div class="thumb${G.filmIdx === 0 ? ' cur' : ''}" data-fi="0"><div style="font-size:28px;text-align:center;padding:10px 0">🎬</div></div>` +
    G.panels.map((p, i) => `<div class="thumb${G.filmIdx === i + 1 ? ' cur' : ''}" data-fi="${i + 1}">${thumbOf(p)}</div>`).join('');
}
function renderLog() {
  const el = $('#log-list'); if (!el) return;
  el.innerHTML = G.log.slice(-60).map(e => `<div><span class="lg-t">${esc(e.t)}</span>${esc(e.txt)}</div>`).join('') ||
    '<div style="color:#b3a6dd">还没有记录。</div>';
}
/* 本机录制出来的片子是内存里的 blob 地址:换新片时要主动释放,不然会一直占着内存 */
function releaseVideoUrl() {
  if (G.videoUrl && /^blob:/i.test(G.videoUrl)) {
    try { URL.revokeObjectURL(G.videoUrl); } catch (e) {}
  }
}
function renderPlayer() {
  const box = $('#film-player'); if (!box) return;
  if (!G.videoUrl) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  /* 下载名要跟真实格式一致:AI 拼出来的是 mp4,本机录的是 webm */
  const isWebm = /\.webm(\?|#|$)/i.test(G.videoUrl);
  const ext = isWebm ? '.webm' : '.mp4';
  const secs = G.filmSeconds ? (' · ' + Math.round(G.filmSeconds) + ' 秒') : '';
  box.innerHTML = `<video src="${esc(G.videoUrl)}" controls autoplay playsinline
      style="width:100%;border-radius:14px;border:2.5px solid #e8def6;background:#000"></video>
    <div class="smallmsg">🎥 这就是你的片子${secs}
    <a href="${esc(G.videoUrl)}" download="《${esc(G.title || '我的电影')}》${ext}">下载这段影片(${ext.slice(1)})</a></div>`;
  const v = box.querySelector('video');
  if (v && !G.filmSeconds) {                 /* 老草稿没存片长 → 从视频本身量一下 */
    v.addEventListener('loadedmetadata', () => {
      const d = Math.round(v.duration || 0);
      if (!d || !isFinite(d)) return;
      G.filmSeconds = d;
      const s = box.querySelector('.smallmsg');
      if (s && s.firstChild) s.firstChild.textContent = '🎥 这就是你的片子 · ' + d + ' 秒 ';
    }, { once: true });
  }
}
/* 用浏览器自带的录制能力,把剧本 + 分镜连成一段真影片(不需要联网/不需要 API)
   注意:离线录制没有配音轨 —— 浏览器的 speechSynthesis 音频进不了 MediaStream,
   以前这里"加了一条静音音轨"假装有配音,已经去掉,改成如实告诉用户。 */
async function makeFilm(onStep) {
  const step = typeof onStep === 'function' ? onStep : () => {};
  if (!G.panels.length) throw new Error('还没有分镜,先回第 5 步画画');
  if (!(window.MediaRecorder && document.createElement('canvas').captureStream)) {
    throw new Error('这个浏览器不支持网页录像,请用 Edge 或 Chrome 打开');
  }
  const W = 1280, H = 800;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  step('① 正在准备画面…');
  const pages = [{ kind: 'cover', dur: 2.6, speak: (G.title || '我的电影') + '。导演' + G.director + '。' + synopsisText() }]
    .concat(G.panels.map((p, i) => ({ kind: 'panel', dur: 3.2, cap: (p.cap || '').trim(), svg: p.svg, img: p.img, speak: (p.cap || '').trim(), idx: i })));
  const imgs = [];
  for (const pg of pages) {
    if (pg.img) { imgs.push(await imgOf(pg.img)); continue; }     /* 有 AI 图就用 AI 图,别退回程序插画 */
    if (!pg.svg) { imgs.push(null); continue; }
    const sized = pg.svg.replace('<svg ', '<svg width="640" height="400" ');
    imgs.push(await new Promise(res => {
      const im = new Image();
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      im.onload = () => fin(im); im.onerror = () => fin(null);
      setTimeout(() => fin(null), 3000);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    }));
  }
  const stream = cv.captureStream(24);
  const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? { mimeType: 'video/webm;codecs=vp9,opus' } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = Date.now();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    step('② 正在录第 ' + (i + 1) + '/' + pages.length + ' 页…');
    const dur = pg.dur * 1000;
    const s0 = Date.now();
    while (true) {
      const el = Date.now() - s0, prog = Math.min(1, el / dur);
      drawPage(ctx, pg, imgs[i], prog, W, H);
      if (el >= dur) break;
      await sleep(40);
    }
  }
  await sleep(200);
  rec.stop(); await stopped;
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  releaseVideoUrl();
  G.videoUrl = url; G.filmMs = Date.now() - t0;
  G.videoModel = '本机录制(无配音)';
  G.videoCost = 0;
  G.filmSeconds = Math.round(pages.reduce((s, p) => s + (p.dur || 0), 0));
  return { url, ms: G.filmMs, pages: pages.length, size: blob.size, blob, silent: true };
}
function drawPage(ctx, pg, img, prog, W, H) {
  ctx.save();
  if (pg.kind === 'cover') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6c5ce7'); g.addColorStop(1, '#14121f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '700 60px "Microsoft YaHei", sans-serif';
    ctx.fillText('《' + (G.title || '我的电影') + '》', W / 2, 330);
    ctx.font = '700 28px "Microsoft YaHei", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText('导演 ' + G.director + ' · AI 实习生 ' + G.intern, W / 2, 395);
    ctx.fillText(G.style ? ('画风:' + G.style) : '', W / 2, 440);
  } else {
    ctx.fillStyle = '#12101c'; ctx.fillRect(0, 0, W, H);
    if (img) { const z = 1 + 0.05 * prog; ctx.drawImage(img, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z); }
    const grad = ctx.createLinearGradient(0, H - 170, 0, H);
    grad.addColorStop(0, 'rgba(10,8,18,0)'); grad.addColorStop(1, 'rgba(10,8,18,.88)');
    ctx.fillStyle = grad; ctx.fillRect(0, H - 170, W, 170);
    if (pg.cap) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '700 32px "Microsoft YaHei", sans-serif';
      ctx.fillText(pg.cap.length > 26 ? pg.cap.slice(0, 26) + '…' : pg.cap, W / 2, H - 56);
    }
  }
  ctx.restore();
}

/* ---------------- 朗读(浏览器自带,免费) ---------------- */
let VOICE = { on: false, ok: !!(window.speechSynthesis) };
function speak(text) {
  if (!VOICE.on || !VOICE.ok || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 200));
    u.lang = 'zh-CN'; u.rate = 0.95;
    const vs = window.speechSynthesis.getVoices() || [];
    const v = vs.find(x => /zh|Chinese/i.test(x.lang + x.name));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} }
function speakPage() {
  if (!VOICE.on) return;
  if (G.filmIdx === 0) speak('《' + (G.title || '我的电影') + '》' + synopsisText());
  else { const p = G.panels[G.filmIdx - 1]; speak((p && p.cap) || '这一页没有台词'); }
}
function syncVoiceBtn() { const b = $('#btn-voice'); if (b) b.textContent = VOICE.on ? '🔊 朗读开' : '🔇 朗读关'; }
function goPage(i) {
  const max = G.panels.length;
  G.filmIdx = Math.max(0, Math.min(max, i));
  showPageInFilm();
  stopSpeak(); speakPage();
}

/* ---------------- 存档 / 作品库 ---------------- */
const THUMB = { w: 360, h: 225, q: 0.72 };          // 存档里只放小图,别把 localStorage 撑爆
function filmItem(id) {
  G.title = ($('#in-title') && $('#in-title').value || G.title || '').trim().slice(0, 24);
  G.refl = [($('#ta-r1') || {}).value || '', ($('#ta-r2') || {}).value || ''];
  G.statement = ($('#ta-statement') || {}).value || '';
  return {
    id: id || G.replayId || ('f' + Date.now()),
    savedAt: new Date().toISOString(),
    director: G.director, intern: G.intern,
    cards: G.slots.filter(s => s.card).map(s => ({ slot: s.name, card: s.card.t, emoji: s.card.e })),
    synopsis: synopsisText(), idea: G.idea, story: G.story, style: G.style,
    title: G.title, refl: G.refl, statement: G.statement,
    panels: G.panels.map(p => ({ cap: p.cap, prm: p.prm, svg: p.svg, thumb: p.thumb || '' })),
    log: G.log.slice(-40), filmMs: G.filmMs || 0, filmSeconds: G.filmSeconds || 0,
    videoUrl: G.videoUrl || '', videoModel: G.videoModel || '',
  };
}
/* 把每格的 AI 图缩成小图塞进作品 —— 否则装订成册/导出/打印之后,AI 画面就全丢了 */
async function withThumbs(item, panels) {
  for (let i = 0; i < item.panels.length; i++) {
    const p = (panels || [])[i] || {};
    if (item.panels[i].thumb || !p.img) continue;
    try { item.panels[i].thumb = await imgToDataUrl(p.img, THUMB.w, THUMB.h, THUMB.q); } catch (e) {}
  }
  return item;
}
function archiveBytes(list) { try { return JSON.stringify(list).length; } catch (e) { return 0; } }
async function saveFilm() {
  const item = await withThumbs(filmItem(), G.panels);
  let list = store.get('bh_archive') || [];
  list = list.filter(x => x.id !== item.id);
  list.unshift(item);
  if (list.length > 24) list = list.slice(0, 24);
  let dropped = 0;
  while (list.length > 1 && archiveBytes(list) > 4 * 1024 * 1024) { list.pop(); dropped++; }   /* 本机存储有上限,先把最旧的挤出去 */
  store.set('bh_archive', list);
  backupArchiveWork(item).catch(() => {
    toast('作品已存在这台浏览器；本机备份服务暂时连不上，稍后打开作品库会再试一次。');
  });
  G.replayId = item.id;
  clearDraft();
  renderArchive();
  let zhiyaMessage = '，并保存到智芽·我的作品草稿';
  try {
    await saveFilmToZhiya(item);
  } catch (error) {
    zhiyaMessage = '；智芽暂未同步，可稍后重试或继续使用本地作品库';
  }
  toast('🎉 作品已保存到本机作品库' + zhiyaMessage
    + (dropped ? '(存储空间有限,顺手清掉了最旧的 ' + dropped + ' 部)' : ''));
}
function renderArchive() {
  const list = store.get('bh_archive') || [];
  const cnt = $('#arch-count'); if (cnt) cnt.textContent = list.length;
  const wrap = $('#arch-list'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<p style="text-align:center;color:#8b7fb8">还没有作品,拍一部就有了!</p>'; return; }
  wrap.innerHTML = list.map(x => {
    const cover = (x.panels || [])[0] || {};
    const shot = cover.thumb
      ? '<img src="' + esc(cover.thumb) + '" alt="" style="width:100%;height:100%;object-fit:cover">'
      : (cover.svg || '🎬');
    return `<div class="arch-item" data-id="${esc(x.id)}">
      <div class="arch-thumb">${shot}</div>
      <div class="arch-info"><b>《${esc(x.title || '无题')}》</b>
        <div class="smallmsg">${esc(x.style || '')} · ${x.panels.length} 页 · ${esc((x.savedAt || '').slice(0, 10))}</div></div>
      <div class="arch-acts">
        <button class="btn btn-mini" data-act="replay">▶️ 重看</button>
        <button class="btn btn-mini" data-act="export">⬇️ 导出</button>
        <button class="btn btn-mini" data-act="print">🖨️ 打印</button>
        <button class="btn btn-mini" data-act="del">🗑</button>
      </div>
    </div>`;
  }).join('');
}
function openArchiveItem(id) {
  const list = store.get('bh_archive') || [];
  const it = list.find(x => x.id === id);
  if (!it) return;
  G.replayId = it.id;
  G.director = it.director || '小导演'; G.intern = it.intern || '小映';
  G.slots = (it.cards || []).map((c, i) => ({ key: 'a' + i, name: c.slot, emoji: c.emoji || '🎬', required: false, custom: false, pool: [], card: { t: c.card, e: c.emoji || '🎬' } }));
  G.idea = it.idea || ''; G.story = it.story || ''; G.style = it.style || '';
  G.title = it.title || ''; G.refl = [it.refl[0] || '', it.refl[1] || '']; G.statement = it.statement || '';
  G.panels = (it.panels || []).map(p => ({ cap: p.cap, prm: p.prm, svg: p.svg, img: p.thumb || '', thumb: p.thumb || '', version: 1, accepted: true, wrong: null, note: '', fix: '' }));
  G.panelsFrom = G.story || '';          /* 重看的作品不要被 initPanels 重新生成掉 */
  G.log = it.log || []; G.filmIdx = 0;
  releaseVideoUrl();                     /* 上一部如果是本机录制,先把 blob 放掉 */
  G.videoUrl = it.videoUrl || ''; G.videoModel = it.videoModel || ''; G.filmSeconds = it.filmSeconds || 0;
  G.filmMs = it.filmMs || 0;
  show('prem'); renderPrem();
  toast('▶️ 正在重看《' + (G.title || '无题') + '》');
}
function downloadText(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);   /* 别把 blob 一直挂在内存里 */
}
async function printFilm(item) {
  const it = item || await withThumbs(filmItem(), G.panels);
  const art = p => p.thumb ? '<img src="' + esc(p.thumb) + '" alt="">' : (p.svg || '');
  const pages = it.panels.map((p, i) => `<div class="print-sheet">
      <div class="svgbox">${art(p)}</div>
      <div class="print-page-caption">第 ${i + 1} 页 · ${esc(p.cap || '')}${p.prm ? '<br><small>画面提示词:' + esc(p.prm) + '</small>' : ''}</div>
    </div>`).join('');
  $('#printRoot').innerHTML = `<div class="print-title">《${esc(it.title || '我的电影')}》</div>
    <div class="print-sub">导演 ${esc(it.director)} · AI 实习生 ${esc(it.intern)} · 画风 ${esc(it.style || '')}<br>${esc(it.synopsis || '')}</div>
    ${pages}
    <div class="print-sub"><b>导演评论:</b><br>① 最满意的一幕:${esc(it.refl[0] || '(未填)')}<br>② 还想改的地方:${esc(it.refl[1] || '(未填)')}<br>${it.statement ? '🎤 ' + esc(it.statement) : ''}</div>
    <div class="print-sub"><b>创作过程:</b><br>${it.log.slice(-18).map(e => '· ' + esc(e.txt)).join('<br>')}</div>`;
  window.print();
}

/* ---------------- 草稿 ---------------- */
let draftTimer = null;
function saveDraft() {
  if (G.stage === 'title') return;
  if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
  store.set('bh_draft', { v: 3, ...G });
  notifyDraft();
}
/* 打字时别每敲一个键就把整份草稿(含几十万字符的 AI 图)写一次 localStorage */
function saveDraftSoon() {
  if (G.stage === 'title') return;
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { draftTimer = null; saveDraft(); }, 500);
}
function clearDraft() {
  if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
  store.set('bh_draft', null);
  notifyDraft();
}
/* 告诉 React 层"草稿有没有变",首页的「继续上次创作」才知道该不该出现 */
function notifyDraft() {
  try {
    nativeDocument.dispatchEvent(new CustomEvent('bh-draft-changed'));
  } catch (e) { /* 老浏览器不支持 CustomEvent 就算了 */ }
}
function tryRestoreDraft() {
  try {
    const d = store.get('bh_draft');
    if (!d || d.v !== 3 || !d.stage || d.stage === 'title') return false;
    Object.assign(G, d);
    G.videoSegments = (G.videoSegments && typeof G.videoSegments === 'object' && !Array.isArray(G.videoSegments)) ? G.videoSegments : {};
    /* 本机录制的片子是内存 blob 地址,刷新后一定失效 —— 别让播放器挂个死链接 */
    if (G.videoUrl && /^blob:/i.test(G.videoUrl)) {
      G.videoUrl = ''; G.videoModel = ''; G.filmSeconds = 0;
      lg('video', '上次本机录制的片子刷新后失效,需要重新录或改用「逐格拍片」');
      setTimeout(() => toast('ℹ️ 上次的「本机录制」片子存在内存里,刷新后失效了;分镜和剧本都在,可以重录', 4000), 800);
    }
    if (!Array.isArray(G.slots) || !G.slots.length) initSlots();
    G.log = d.log || [];
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === screenId(G.stage)));
    renderCreationGuide(G.stage);
    const r = { card: renderSlots, idea: renderIdea, story: renderStory, style: renderStyle, board: renderBoard, prem: renderPrem }[G.stage];
    if (r) r();
    refreshStepbar(); syncDownstreamNotes();
    toast('📽️ 上次没拍完的片子已恢复,继续创作吧!');
    return true;
  } catch (e) {
    /* 草稿坏了:先原样留一份备份,再当没有草稿重新开始,别让孩子的作品凭空消失 */
    try { store.set('bh_draft_bad', store.get('bh_draft') || null); } catch (e2) {}
    if (typeof console !== 'undefined' && console.warn) console.warn('草稿恢复失败,已备份到 bh_draft_bad', e);
    toast('⚠️ 上次的草稿读不出来,已备份到 bh_draft_bad,这次从新的一页开始');
    return false;
  }
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  /* 步骤条 */
  document.addEventListener('click', e => {
    const st = e.target.closest('.step[data-step]');
    if (st) { jumpTo(+st.getAttribute('data-step')); return; }
    const go = e.target.closest('[data-go]');
    if (go) {
      const st2 = go.getAttribute('data-go').replace('sc-', '');
      if (st2 === 'idea') renderIdea();
      if (st2 === 'story') renderStory();
      if (st2 === 'style') renderStyle();
      if (st2 === 'board') { if (!G.panels.length) initPanels(); renderBoard(); }
      if (st2 === 'card') renderSlots();
      show(st2);
      return;
    }
    /* 槽位操作 */
    const slotAct = e.target.closest('[data-act]');
    if (slotAct) {
      const card = slotAct.closest('.slotcard');
      if (card && card.dataset.i !== undefined) {
        const i = +card.dataset.i;
        const act = slotAct.getAttribute('data-act');
        if (act === 'draw') return drawSlot(i);
        if (act === 'write') return writeSlot(i);
        if (act === 'clearcard') return clearSlotCard(i);
        if (act === 'delslot') {
          G.slots.splice(i, 1);
          slotsChanged(); toast('格子已删除');
          return;
        }
      }
      const stCard = slotAct.closest('[data-style]');
      if (stCard && slotAct.getAttribute('data-act') === 'usepick') return chooseStyle(stCard.getAttribute('data-style'));
      /* 作品库操作 */
      const arch = slotAct.closest('.arch-item');
      if (arch) {
        const id = arch.dataset.id, act = slotAct.getAttribute('data-act');
        const list = store.get('bh_archive') || [];
        const it = list.find(x => x.id === id);
        if (act === 'replay') return openArchiveItem(id);
        if (act === 'export') return downloadText('《' + (it.title || '作品') + '》.bhfilm', JSON.stringify(it, null, 2));
        if (act === 'print') return printFilm(it);
        if (act === 'del') {
          if (!confirm('删掉《' + (it.title || '无题') + '》?删了就找不回来了')) return;
          store.set('bh_archive', list.filter(x => x.id !== id)); renderArchive();
          deleteArchiveWork(id).catch(() => {
            toast('这台浏览器已删除；本机备份服务暂时连不上，稍后打开作品库会再试一次。');
          });
          toast('已删除');
          return;
        }
      }
    }
    /* 首映礼分镜操作 */
    const pa = e.target.closest('.act-paint, .act-accept');
    if (pa) {
      const panel = pa.closest('.panel');
      const p = G.panels[+panel.dataset.i];
      if (pa.classList.contains('act-paint')) {
        p.prm = panel.querySelector('.prm').value;
        p.cap = panel.querySelector('.cap').value;
        if (p.img) { p.img = null; p.aiDrawn = false; p.aiMsg = ''; toast('这一格换回免费程序画师;想要 AI 图就点「🖼️ AI 画这格」'); }
        paintPanel(p, +panel.dataset.i);
        G.panelsStale = true;
        lg('paint', '第 ' + (+panel.dataset.i + 1) + ' 格重画(v' + p.version + ')');
      } else {
        p.accepted = !p.accepted;
        if (p.accepted) { p.wrong = null; p.note = ''; paintPanel(p, +panel.dataset.i); toast('✅ 这格通过!(错版也能留,导演说了算)'); }
      }
      renderPanels(); saveDraft();
      return;
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'ta-idea') { G.idea = e.target.value; markStoryStale(); }
    if (e.target.id === 'ta-story') G.story = e.target.value;
    if (e.target.classList.contains('prm')) { G.panels[+e.target.closest('.panel').dataset.i].prm = e.target.value; }
    if (e.target.classList.contains('cap')) { G.panels[+e.target.closest('.panel').dataset.i].cap = e.target.value; }
    if (e.target.closest('.screen.active')) saveDraftSoon();
  });

  /* ---------------- 长按拖动(鼠标和手指同一套) ----------------
     按住 200ms 进入拖动:浮层跟着指针走,松手落在哪个格子就应用哪种改动。
     长按卡片 → 换卡(目标空就搬过去,有卡就互换);长按格子名 → 整个格子挪位置。
     长按期间移动超过 12px 当作滑动,不进入拖动,页面照常滚动。 */
  (function longPressDrag() {
    window.__longPressDragReady = true;
    let timer = null, active = false, kind = '', from = -1, ghost = null, target = -1;
    let sx = 0, sy = 0, pointerId = null, handleEl = null;

    const slotCards = () => $$('#slot-grid .slotcard');
    const clearVisual = () => {
      slotCards().forEach(x => x.classList.remove('dragover'));
      $$('#slot-grid [data-drag]').forEach(x => x.classList.remove('dragging'));
      document.body.classList.remove('bh-dragging', 'bh-dragging-card', 'bh-dragging-slot');
    };
    const slotIndexAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const sc = (el && el.closest) ? el.closest('.slotcard') : null;
      return sc ? +sc.dataset.i : -1;
    };

    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (ghost) { ghost.remove(); ghost = null; }
      active = false; kind = ''; from = -1; target = -1; pointerId = null; handleEl = null;
      clearVisual();
    }

    function beginDrag(x, y) {
      from = +handleEl.closest('.slotcard').dataset.i;
      kind = handleEl.getAttribute('data-drag');
      const slot = G.slots[from] || {};
      const card = slot.card || {};
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = kind === 'card' ? ((card.e || '') + ' ' + (card.t || '')) : ((slot.emoji || '') + ' ' + (slot.name || ''));
      ghost.style.left = x + 'px';
      ghost.style.top = y + 'px';
      document.body.appendChild(ghost);
      handleEl.classList.add('dragging');
      document.body.classList.add('bh-dragging', kind === 'card' ? 'bh-dragging-card' : 'bh-dragging-slot');
      active = true;
      try { if (handleEl.setPointerCapture && pointerId !== null) handleEl.setPointerCapture(pointerId); } catch (err) {}
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) {} }
      toast(kind === 'card' ? '拖到别的格子,松手就换位置' : '拖到想放的位置,松手就调整顺序');
    }

    document.addEventListener('pointerdown', e => {
      if (e.isPrimary === false) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;   /* 只认左键 */
      const handle = e.target.closest ? e.target.closest('#slot-grid [data-drag]') : null;
      if (!handle || e.target.closest('button')) return;        /* ✖ 之类的小按钮不算拖动 */
      const slot = G.slots[+handle.closest('.slotcard').dataset.i];
      if (!slot) return;
      if (handle.getAttribute('data-drag') === 'card' && !slot.card) return;
      cancel();
      handleEl = handle; pointerId = e.pointerId;
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => { timer = null; beginDrag(e.clientX, e.clientY); }, LONG_PRESS_MS);
    }, { passive: true });

    document.addEventListener('pointermove', e => {
      if (!active) {
        if (timer && (Math.abs(e.clientX - sx) > SLIDE_CANCEL_PX || Math.abs(e.clientY - sy) > SLIDE_CANCEL_PX)) {
          clearTimeout(timer); timer = null; handleEl = null; pointerId = null;
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
      const i = slotIndexAt(e.clientX, e.clientY);
      if (i === target) return;
      target = i;
      slotCards().forEach(x => x.classList.toggle('dragover', +x.dataset.i === i && i !== from));
    }, { passive: false });

    const finish = e => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!active) { handleEl = null; pointerId = null; return; }
      const to = slotIndexAt(e.clientX, e.clientY);
      const draggedKind = kind, draggedFrom = from;
      cancel();
      if (to < 0 || to === draggedFrom) return;
      if (draggedKind === 'card') dropCard(draggedFrom, to);
      else dropSlot(draggedFrom, to);
    };
    document.addEventListener('pointerup', finish, { passive: true });
    document.addEventListener('pointercancel', () => cancel(), { passive: true });
    /* Esc 取消要挂在真的 document 上:没聚焦输入框时按键目标是 body,不在 root 里 */
    nativeDocument.addEventListener('keydown', e => { if (e.key === 'Escape' && (active || timer)) cancel(); }, { signal: controller.signal });
  })();

  /* 位置 1 */
  $('#btn-addslot').onclick = addSlot;
  $('#btn-drawall').onclick = drawAll;
  $('#btn-clearall').onclick = clearAll;
  $('#btn-card2idea').onclick = () => {
    if (!requiredCardsDone()) { toast('先把主角、场景、经过抽出来(或自己写)'); return; }
    G.ideaStale = false; renderIdea(); show('idea');
  };

  /* 位置 2 */
  $('#btn-idea2story').onclick = () => {
    G.idea = ($('#ta-idea').value || '').trim();
    G.storyStale = false;
    show('story');
    /* 有 AI 编剧就直接生成(ai.js 提供);没有就退回离线整理草稿 */
    if (typeof aiScriptFromIdea === 'function' && aiScriptFromIdea()) return;
    ideaToStoryDraft(); renderStory(); refreshStepbar(); saveDraft();
    toast('📜 剧本草稿好了,不满意直接改!');
  };

  /* 位置 3 */
  $('#btn-story-save').onclick = () => {
    G.story = $('#ta-story').value;
    G.storyStale = false;
    G.panels = []; G.panelsFrom = ''; G.panelsStale = true;
    lg('story', '导演手改了剧本 → ' + G.story.split('\n').filter(Boolean).length + ' 页');
    renderStory(); refreshStepbar(); syncDownstreamNotes(); saveDraft();
    toast('✅ 剧本存好了,分镜会按这个版本重画');
  };
  $('#btn-story2style').onclick = () => { G.story = $('#ta-story').value || G.story; renderStyle(); show('style'); };

  /* 位置 4 */
  $('#btn-style-custom').onclick = () => {
    const v = ($('#in-style-custom').value || '').trim();
    if (!v) { toast('先写一个你想要的画风'); return; }
    chooseStyle(v);
  };
  $('#btn-style2board').onclick = () => {
    if (!G.style) { toast('先选一个画风'); return; }
    initPanels(); renderBoard(); show('board');
  };

  /* 位置 5 */
  $('#btn-addpanel').onclick = addPanel;
  $('#btn-delpanel').onclick = delPanel;
  $('#btn-paintall').onclick = () => {
    G.panels.forEach((p, i) => { p.img = ''; p.aiDrawn = false; p.aiMsg = ''; paintPanel(p, i); });
    renderPanels(); lg('paint', '全部重画了一遍(换回程序画师)');
    toast('🎨 全部用程序画师重画了;想要 AI 图就在格子里点「🖼️ AI 画这格」');
  };
  $('#btn-board2prem').onclick = () => {
    if (!G.panels.length) initPanels();
    const blank = G.panels.filter(p => !p.img && !p.svg);
    blank.forEach(p => paintPanel(p, G.panels.indexOf(p)));
    if (blank.length) toast('有 ' + blank.length + ' 格还没画,先用程序画师垫上;回第 5 步可以换成 AI 图');
    G.filmIdx = 0; renderPrem(); show('prem');
    toast('🎬 到了首映礼!点「🎬 逐格拍片 + 配音」就能出片');
  };

  /* 位置 6(「本机录制」按钮在 ensurePremUI 里统一挂,这里不再重复绑定) */
  $('#btn-prev').onclick = () => { stopAuto(); goPage(G.filmIdx - 1); };
  $('#btn-next').onclick = () => { stopAuto(); goPage(G.filmIdx + 1); };
  $('#btn-auto').onclick = toggleAuto;
  $('#btn-voice').onclick = () => {
    if (!VOICE.ok) { toast('这个浏览器不支持朗读,建议用 Edge/Chrome'); return; }
    VOICE.on = !VOICE.on; syncVoiceBtn();
    if (VOICE.on) { speakPage(); toast('🔊 朗读已开,翻页自动念台词'); } else stopSpeak();
  };
  $('#btn-backstage').onclick = () => { const b = $('#backstage'); b.classList.toggle('hidden'); renderBackstage(); };
  $('#filmstrip').onclick = e => { const t = e.target.closest('.thumb'); if (t) { stopAuto(); goPage(+t.dataset.fi); } };
  $('#btn-save').onclick = saveFilm;
  $('#btn-exportfilm').onclick = async () => {
    const it = await withThumbs(filmItem(), G.panels);
    downloadText('《' + (it.title || '作品') + '》.bhfilm', JSON.stringify(it, null, 2));
    toast('⬇️ 已导出作品文件(含画面缩略图)');
  };
  $('#btn-print').onclick = () => printFilm();

  /* 首页 */
  $('#btn-newfilm').onclick = () => {
    G.director = ($('#in-director').value || '小导演').trim().slice(0, 12);
    G.intern = ($('#in-intern').value || '小映').trim().slice(0, 8);
    store.set('bh_profile', { director: G.director, intern: G.intern });   /* 下次打开还记得导演名字 */
    Object.assign(G, { idea: '', story: '', storyDraft: '', style: '', stylePicked: false, panels: [], panelsFrom: '', aiShots: 0, title: '', refl: ['', ''], statement: '', log: [], replayId: '', videoUrl: '', filmMs: 0, filmSeconds: 0, videoSegments: {} });
    initSlots(); renderSlots(); navReason = 'new-film'; show('card');
    toast('🎬 开拍!先抽三张必抽的卡');
  };
  $('#btn-archive').onclick = () => {
    const w = $('#arch-list'); const opening = G.stage !== 'title' || w.classList.contains('hidden');
    show('title'); w.classList.toggle('hidden', !opening); renderArchive();
    if (opening) syncArchiveFromServer();
  };
  $('#btn-settings').onclick = () => { openSettings(); $('#m-settings').classList.remove('hidden'); };
  $('#btn-help').onclick = () => $('#m-help').classList.remove('hidden');
  $('#btn-help-close').onclick = () => $('#m-help').classList.add('hidden');
  $('#btn-settings-close').onclick = () => $('#m-settings').classList.add('hidden');
  $$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); }));
  /* Esc 关弹窗:键盘用户以前只能靠点"完成" */
  nativeDocument.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = $$('.overlay').filter(o => !o.classList.contains('hidden'));
    if (!open.length) return;
    open.forEach(o => o.classList.add('hidden'));
  }, { signal: controller.signal });

  /* 设置 */
  $('#wrong-on').onclick = () => { G.wrongOn = true; openSettings(); toast('☠️ 翻车时刻已开:提示词写糊了小映就会画错——这正是教学点'); };
  $('#wrong-off').onclick = () => { G.wrongOn = false; openSettings(); toast('😇 翻车时刻已关,小映这次不闹脾气'); };
  const clrMine = $('#btn-clear-mine');
  if (clrMine) clrMine.onclick = () => {
    if (!confirm('清掉你自己加进卡池的所有卡?(当前台上的卡和格子都不动)')) return;
    saveMyCards({});
    /* 只从卡池里摘掉"我加的卡",不要把已经抽好的格子、顺序、自定义格子冲掉 */
    let removed = 0;
    G.slots.forEach(s => {
      const mineCards = s.pool.filter(c => c.mine);
      removed += mineCards.length;
      s.pool = s.pool.filter(c => !c.mine);
      if (s.card && mineCards.some(c => c.t === s.card.t)) s.card = null;
    });
    slotsChanged();
    $('#data-msg').textContent = removed
      ? '清掉了 ' + removed + ' 张你自己加的卡,卡池回到标准张数。'
      : '你还没有往卡池里加过卡。';
  };
  $('#btn-clear-draft').onclick = () => { clearDraft(); $('#data-msg').textContent = '草稿已清掉。'; };
  $('#btn-clear-all').onclick = () => {
    if (!confirm('清空本机所有数据(作品库、草稿、设置)?清了就找不回来了')) return;
    const workIds = (store.get('bh_archive') || []).map(w => w && w.id).filter(Boolean);
    try { localStorage.clear(); } catch (e) {}
    Promise.all(workIds.map(id => deleteArchiveWork(id))).catch(() => {
      $('#data-msg').textContent = '浏览器数据已清空；本机备份删除失败，稍后打开作品库会再试一次。';
    });
    $('#data-msg').textContent = '已清空,刷新页面就回到全新状态。';
  };
}
function openSettings() {
  const on = G.wrongOn;
  $('#wrong-on').style.background = on ? '#00b894' : '';
  $('#wrong-on').style.color = on ? '#fff' : '';
  $('#wrong-off').style.background = on ? '' : '#e17055';
  $('#wrong-off').style.color = on ? '' : '#fff';
}
function renderBackstage() {
  const b = $('#backstage');
  b.innerHTML = G.panels.map((p, i) => `<div style="margin-bottom:8px">
      <b>第 ${i + 1} 格</b> · 画面提示词:${esc(p.prm || '(空着,' + internName() + '只能自己发挥)')}
      ${p.wrong ? '<br><span style="color:#ff9f8a">⚠️ 这一格翻过车:' + esc(p.wrong) + '</span>' : ''}
    </div>`).join('') || '还没有分镜';
}

/* ---------------- 启动 ---------------- */
function boot() {
  const prof = store.get('bh_profile');
  if (prof && prof.director) $('#in-director').value = prof.director;
  if (prof && prof.intern) $('#in-intern').value = prof.intern;    /* 以前只恢复导演名,实习生名每次都被重置 */
  initSlots();
  if (!tryRestoreDraft()) { show('title'); }
  renderArchive();
}
bindEvents();
boot();

/* ============================================================
   脑洞放映厅 · AI 接入层(v5)
   四个能力全部走后端 /api/*(Key 在服务器,浏览器拿不到任何 Key):
     故事简介 / 写剧本 / 提示词润色 → GLM-5.2
     画分镜                          → Seedream 5.0 Lite
     生成影片                        → Seedance(自动挑账号已开通的)
     配音                            → GLM-TTS
   本文件是"插件":只从外面包一层,不改 game.js 主逻辑;
   没有后端 / --no-ai / ?demo=1 时,游戏照旧离线可玩。
   ============================================================ */
/* global G, $, $$, esc, toast, lg, store, renderIdea, renderStory, renderPanels, renderPrem, renderPlayer, buildSVG, drawPage, synopsisText, ideaToStoryDraft, initPanels */

const BK = {
  ok: false,
  enabled: !/[?&]demo=1/.test(location.search),   // ?demo=1 = 强制离线(测试/断网课堂)
  mod: {},
  usage: { imgLimit: 12, videoLeft: 30, videoUnlimited: false, videosToday: 0, maxSegments: 10 },
  busy: { story: false, img: {}, video: false },
  lastErr: '',
};

async function bkFetch(path, body, ms, method) {
  const r = await fetch(path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(ms || 180000) : undefined,
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg = j.error || msg; } catch (e) {}
    BK.lastErr = msg;
    throw new Error(msg);
  }
  return await r.json();
}
const bkGet = (p, ms) => bkFetch(p, null, ms);
const bkPost = (p, b, ms) => bkFetch(p, b, ms);
const bkDelete = (p, ms) => bkFetch(p, null, ms, 'DELETE');

/* ---------- 作品库:浏览器缓存 + 本机 SQLite 备份 ---------- */
const ARCHIVE_MAX = 24;
function archiveTime(work) {
  const t = Date.parse((work && work.savedAt) || '');
  return Number.isFinite(t) ? t : 0;
}
function mergeArchiveWorks(local, backedUp) {
  const byId = new Map();
  [...(backedUp || []), ...(local || [])].forEach(work => {
    if (!work || typeof work !== 'object' || !work.id) return;
    const old = byId.get(work.id);
    if (!old || archiveTime(work) >= archiveTime(old)) byId.set(work.id, work);
  });
  return Array.from(byId.values())
    .sort((a, b) => archiveTime(b) - archiveTime(a))
    .slice(0, ARCHIVE_MAX);
}
async function backupArchiveWork(work) {
  if (!BK.enabled || !work || !work.id) return;
  await bkPost('/api/works', { work }, 30000);
}
async function deleteArchiveWork(id) {
  if (!BK.enabled || !id) return;
  await bkDelete('/api/works/' + encodeURIComponent(id), 15000);
}
async function syncArchiveFromServer() {
  if (!BK.enabled) return;
  try {
    const listing = await bkGet('/api/works?limit=100', 20000);
    const summaries = Array.isArray(listing.works) ? listing.works : [];
    const backedUp = [];
    for (const summary of summaries) {
      if (!summary || !summary.id) continue;
      const item = await bkGet('/api/works/' + encodeURIComponent(summary.id), 20000);
      if (item && item.work && typeof item.work === 'object') backedUp.push(item.work);
    }
    const local = store.get('bh_archive') || [];
    const merged = mergeArchiveWorks(local, backedUp);
    store.set('bh_archive', merged);
    renderArchive();

    const remoteById = new Map(backedUp.map(work => [work.id, work]));
    await Promise.all(merged
      .filter(work => !remoteById.has(work.id) || archiveTime(work) > archiveTime(remoteById.get(work.id)))
      .map(backupArchiveWork));
  } catch (e) {
    /* 无后端、断网、服务重启时保留浏览器里的作品，不打断孩子继续创作。 */
  }
}

async function bkBoot() {
  try {
    const data = await bkGet('/api/config', 25000);
    BK.ok = !!data.backend;
    BK.mod = data.modules || {};
    if (data.limits) {
      BK.usage.imgLimit = data.limits.images || 12;
      BK.usage.videoLeft = data.limits.videosPerDay;
      BK.usage.videoUnlimited = !!data.limits.videoUnlimited;
      BK.usage.videosToday = data.limits.videosToday || 0;
      BK.usage.maxSegments = data.limits.maxFilmSegments || 10;
    }
    if (!BK.enabled) Object.keys(BK.mod).forEach(k => { BK.mod[k] = { ready: false, off: true, model: BK.mod[k].model }; });
  } catch (e) { BK.ok = false; BK.lastErr = String(e.message || e); }
  bkBadge();
}
async function bkRefresh() {           /* 网络状态可能变了,用之前再问一次 */
  try { const d = await bkGet('/api/config', 6000); if (d.modules) BK.mod = d.modules; bkBadge(); } catch (e) {}
}
const ready = k => !!(BK.enabled && BK.mod[k] && BK.mod[k].ready);
const modelOf = k => (BK.mod[k] && BK.mod[k].model) || '';

/* ---------- 顶部「AI 片场」徽章 ---------- */
function bkBadge() {
  let el = $('#ai-badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ai-badge';
    el.className = 'ai-badge';
    (document.querySelector('header .row') || document.body).appendChild(el);
  }
  if (!BK.ok) {
    el.innerHTML = '🔌 离线模式(全部本机,免费用)';
    el.title = '没连上后端:游戏照旧能玩——剧本走整理模式、画面走程序化插画、影片本机录制';
    return;
  }
  const chip = (k, name, icon) => {
    const m = BK.mod[k] || {};
    if (!ready(k)) return `<span class="ai-off" title="服务器没配这一项的 Key,或用了 --no-ai">${icon} ${name}</span>`;
    if (m.reach === false) return `<span class="ai-bad" title="这台电脑现在连不上 ${m.net},所以这个功能用不了(可以开代理后在 .env 里填 HTTPS_PROXY)">${icon} ${name}⛔</span>`;
    return `<span class="ai-on" title="用 ${esc(m.model)}">${icon} ${name}</span>`;
  };
  el.innerHTML = '<span class="ai-title">AI 片场:</span>' + chip('synopsis', '简介', '📖') + chip('story', '编剧', '✍️') +
    chip('polish', '润色', '✨') + chip('image', '画师', '🎨') + chip('video', '影片', '🎥') + chip('tts', '配音', '🎙️');
}

const myAI = () => ((typeof G !== 'undefined' && G && G.intern) || '小映');   /* G 是全局词法变量,不在 window 上 */
const cardsOf = () => (G.slots || []).filter(s => s.card).map(s => ({ slot: s.name, card: s.card.t }));

/* ============================================================
   ② 讲想法:故事简介交给 GLM-5.2 写通顺
   ============================================================ */
function ensureIdeaUI() {
  const box = $('#idea-synopsis');
  if (!box) return;
  if ($('#btn-ai-syn')) {                          /* 按钮已在页面里:只需挂事件 */
    if (!$('#btn-ai-syn')._wired) {
      $('#btn-ai-syn')._wired = true;
      $('#btn-ai-syn').onclick = () => aiSynopsis(false);
      $('#btn-ai-syn-again').onclick = () => aiSynopsis(true);
    }
    return;
  }
  const tag = document.createElement('div');
  tag.id = 'idea-syn-tag';
  tag.className = 'smallmsg';
  tag.style.marginTop = '4px';
  box.parentNode.insertBefore(tag, box.nextSibling);
  const row = document.createElement('div');
  row.className = 'row';
  row.style.margin = '8px 0';
  row.innerHTML = '<button id="btn-ai-syn" class="btn btn-primary">✨ 让 AI 把简介写通顺</button>' +
    '<button id="btn-ai-syn-again" class="btn btn-mini">🔁 换一版</button>' +
    '<span id="ai-syn-msg" class="smallmsg"></span>';
  tag.parentNode.insertBefore(row, tag.nextSibling);
  $('#btn-ai-syn').onclick = () => aiSynopsis(false);
  $('#btn-ai-syn-again').onclick = () => aiSynopsis(true);
}

let _synSig = '';
async function aiSynopsis(regen) {
  const btn = $('#btn-ai-syn'), msg = $('#ai-syn-msg');
  const say = t => { if (msg) msg.textContent = t; };
  if (!ready('synopsis')) { say('❌ 简介模型没就绪(看顶部 AI 片场徽章)'); return; }
  if (!cardsOf().length) { say('先去第 1 步抽几张卡吧'); return; }
  _synSig = sigOfCards();
  if (btn) { btn.disabled = true; btn.textContent = '📖 AI 组织语言中…'; }
  say('⏳ 正在把卡和你的补充写成一段通顺的简介…');
  try {
    const t0 = Date.now();
    const d = await bkPost('/api/synopsis', { cards: cardsOf(), idea: ($('#ta-idea') && $('#ta-idea').value) || G.idea || '' }, 90000);
    const syn = String(d.synopsis || '').trim();
    if (!syn) throw new Error('模型没返回内容');
    G.synopsis = syn;
    if (typeof renderIdea === 'function') renderIdea();
    lg('synopsis', 'AI 写好了故事简介(' + Math.round((Date.now() - t0) / 1000) + ' 秒)');
    say('✅ ' + modelOf('synopsis') + ' 写的 · ' + Math.round((Date.now() - t0) / 1000) + ' 秒' + (regen ? '(换了一版)' : ''));
    toast('📖 简介写通顺了,不满意可以再换一版');
  } catch (e) {
    say('❌ ' + friendlyGenerationError('synopsis', e.message).message + ' 先用程序拼的那版也没关系。');
  }
  if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 把简介写通顺'; }
}
const sigOfCards = () => cardsOf().map(c => c.slot + ':' + c.card).join('|');
/* 卡片一变,旧简介就作废:下次进"讲想法"自动重写 */
async function autoSynopsis() {
  ensureIdeaUI();
  if (!ready('synopsis')) return;
  if (!cardsOf().length) return;
  if (G.synopsis && _synSig === sigOfCards()) return;
  await aiSynopsis(false);
}

/* ============================================================
   ③ 写剧本:直接让 AI 用"卡 + 想法"生成,孩子再改
   ============================================================ */
const STORY_BUSY = '⏳ AI 编剧正在写剧本…\n(用的是你抽到的卡和上面补充的想法)';

function aiScriptFromIdea() {            // 返回 true = 交给 AI 写(由 ai.js 接管)
  if (!ready('story')) return false;
  if (BK.busy.story) return true;
  aiWriteStory(false, true);
  return true;
}

async function aiWriteStory(regen, auto) {
  const btn = $('#btn-ai-story'), msg = $('#ai-story-msg'), ta = $('#ta-story'), bub = $('#bub-story');
  const say = t => { if (msg) msg.textContent = t; };
  if (!ready('story')) { say('❌ 编剧模型没就绪(看顶部 AI 片场徽章)'); return; }
  if (BK.busy.story) return;
  BK.busy.story = true;
  const oldLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '✍️ 编剧动笔中…'; }
  if (auto) {
    if (ta) ta.value = STORY_BUSY;
    if (bub) bub.innerHTML = '🤖 ' + esc(myAI()) + ':稍等一下,我在把「抽到的卡 + 你补充的想法」编成剧本…';
  }
  say('⏳ ' + modelOf('story') + ' 正在写(通常 2~10 秒)…');
  try {
    G.idea = ($('#ta-idea') && $('#ta-idea').value) || G.idea || '';
    const t0 = Date.now();
    const d = await bkPost('/api/story', {
      cards: cardsOf(), idea: G.idea, synopsis: G.synopsis || synopsisText(),
      old: regen ? (ta && ta.value) || G.story || '' : '',
    }, 180000);
    const lines = (d.lines || []).filter(Boolean);
    if (!lines.length) throw new Error('编剧没写出内容,再点一次试试');
    G.story = lines.join('\n');
    G.storyStale = false;
    G.panels = []; G.panelsFrom = ''; G.panelsStale = true;
    refreshStepbar(); saveDraft();
    G.storyDraft = G.story;
    if (ta) ta.value = G.story;
    const secs = Math.round((Date.now() - t0) / 1000);
    lg('story', 'AI 编剧写出 ' + lines.length + ' 页剧本(' + secs + ' 秒)');
    renderStory();
    say('✅ ' + modelOf('story') + ' 写好了(' + secs + ' 秒 · ' + lines.length + ' 页)。下面是草稿,想改哪儿直接改。');
    toast('✍️ 剧本来了!不满意可以直接改字或点「🔁 换一版」');
  } catch (e) {
    const friendly = friendlyGenerationError('story', e.message);
    if (auto) {                       // AI 没成 → 退回离线整理草稿,别让孩子卡住
      try { ideaToStoryDraft(); renderStory(); } catch (e2) {}
      say('❌ ' + friendly.message + ' 已先用离线草稿顶上，你可以自己改。');
    } else {
      say('❌ ' + friendly.message);
    }
  }
  BK.busy.story = false;
  if (btn) { btn.disabled = false; btn.textContent = oldLabel || ('✨ 让' + myAI() + '用 AI 写剧本'); }
}

function ensureStoryUI() {
  const ta = $('#ta-story');
  const btn = $('#btn-ai-story');
  if (!ta || !btn) return;
  btn.textContent = '✨ 让' + myAI() + '用 AI 写剧本';          /* 实习生改名后跟着变 */
  if (!btn._wired) {
    btn._wired = true;
    btn.onclick = () => aiWriteStory(false, true);
    const regen = $('#btn-ai-regen');
    if (regen) regen.onclick = () => {
      if (ready('story')) return aiWriteStory(true, true);       /* 有 AI → 换一版 */
      G.idea = ($('#ta-idea') && $('#ta-idea').value) || G.idea || '';
      ideaToStoryDraft(); renderStory();                        /* 没 AI → 离线重排 */
      toast('🔁 重新整理好了(离线:只按你说的顺序排)');
    };
  }
  const bub = $('#bub-story');
  if (bub && ready('story')) {
    bub.innerHTML = '🤖 ' + esc(myAI()) + ':这是我用 AI 写的剧本——<b>每一行就是一页分镜</b>。' +
      '<br><small>你抽到的卡和补充的想法我都用上了;想改就点「🔁 换一版」,或者直接改文字,你才是导演。</small>';
  }
}

/* ============================================================
   ⑤ 画分镜:Seedream 5.0 Lite 出图 + 提示词润色
   ============================================================ */
function shrinkImg(src, maxW) {           // 把大图压小,免得存草稿时挤爆浏览器
  return new Promise(resolve => {
    if (!/^data:image\//.test(src) || /^data:image\/svg/.test(src)) return resolve(src);
    const im = new Image();
    im.onload = () => {
      try {
        if (im.width <= maxW) return resolve(src);
        const sc = maxW / im.width;
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
        const cx = cv.getContext('2d');
        if (!cx) return resolve(src);
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        const out = cv.toDataURL('image/jpeg', 0.82);
        resolve(out && out.length < src.length ? out : src);
      } catch (e) { resolve(src); }
    };
    im.onerror = () => resolve(src);
    setTimeout(() => resolve(src), 4000);
    im.src = src;
  });
}

async function aiPolish(panelEl) {
  const i = +panelEl.dataset.i, p = G.panels[i];
  if (!p) return;
  p.cap = panelEl.querySelector('.cap').value;
  p.prm = panelEl.querySelector('.prm').value;
  const btn = panelEl.querySelector('.act-polish');
  btn.disabled = true; const old = btn.textContent; btn.textContent = '✨ 润色中…';
  p.aiMsg = '⏳ 让 AI 把提示词写具体…';
  drawAiMsg(panelEl, p);
  try {
    const d = await bkPost('/api/polish', { cap: p.cap, prompt: p.prm, style: G.style }, 90000);
    p.prm = String(d.prompt || '').trim();
    p.aiMsg = '✅ 提示词具体多了,现在点「🖼️ AI 画这格」试试';
    lg('polish', '第 ' + (i + 1) + ' 格提示词润色好了');
  } catch (e) {
    p.aiMsg = '❌ ' + friendlyGenerationError('polish', e.message).message + ' 也可以自己写清楚：谁、在哪、在做什么。';
  }
  btn.disabled = false; btn.textContent = old;
  renderPanels(); saveDraft();
}

async function aiPaint(panelEl) {
  const i = +panelEl.dataset.i, p = G.panels[i];
  if (!p) return;
  p.cap = panelEl.querySelector('.cap').value;
  p.prm = panelEl.querySelector('.prm').value;
  const btn = panelEl.querySelector('.act-aipaint');
  if (!ready('image')) { p.aiMsg = '❌ 画师模型没就绪(看顶部 AI 片场徽章)'; renderPanels(); return; }
  if (BK.mod.image.reach === false) await bkRefresh();          /* 先确认是不是网络问题 */
  if (BK.mod.image && BK.mod.image.reach === false) {
    p.aiMsg = '⛔ 这台电脑现在连不上火山方舟(出图服务 ' + BK.mod.image.net + ')。可以先点「🎨 重画这格」用免费画师,或者检查网络/代理后再试。';
    renderPanels(); lg('ai-paint', '出图跳过:网络不通'); return;
  }
  if (BK.busy.img[i]) return;
  const imgLimit = BK.usage.imgLimit || 12;
  const imgLeft = Math.max(0, imgLimit - (G.aiShots || 0));   /* 额度跟着草稿走,刷新页面不会白送 */
  if (imgLeft <= 0) {
    p.aiMsg = '⚠️ 这部片子的 AI 出图额度用完了(每部 ' + imgLimit + ' 张),可以点「🎨 重画这格」用免费的程序画师。';
    renderPanels(); return;
  }
  BK.busy.img[i] = true;
  if (btn) { btn.disabled = true; btn.textContent = '🎨 AI 画画中…'; }
  p.aiMsg = '⏳ ' + modelOf('image') + ' 正在画(大约 15~30 秒)…';
  drawAiMsg(panelEl, p);
  const prompt = [G.style, (p.prm || p.cap || '').trim(), '儿童绘本插画,明亮温暖,整张图不出现任何文字'].filter(Boolean).join('。');
  try {
    const t0 = Date.now();
    const d = await bkPost('/api/image', { prompt }, 300000);
    if (!d.src) throw new Error('画师没给图');
    p.img = await shrinkImg(d.src, 1280);      // 压到 1280px,省内存也够放影片
    p.version++;
    p.wrong = null; p.note = ''; p.fix = '';
    p.aiDrawn = true;
    G.aiShots = (G.aiShots || 0) + 1;
    const secs = Math.round((Date.now() - t0) / 1000);
    const left = Math.max(0, imgLimit - G.aiShots);
    p.aiMsg = '✅ ' + modelOf('image') + ' 画好了(' + secs + ' 秒 · 这部还剩 ' + left + ' 张额度)';
    lg('ai-paint', '第 ' + (i + 1) + ' 格 AI 出图(' + secs + ' 秒,剩 ' + left + ' 张)');
    toast('🎨 第 ' + (i + 1) + ' 格画好了!不满意就改提示词再画一次');
  } catch (e) {
    p.aiMsg = '❌ ' + friendlyGenerationError('image', e.message).message + ' 可以点「🎨 重画这格」用免费画师，或改改提示词再试。';
    lg('ai-paint', '第 ' + (i + 1) + ' 格出图失败');
  }
  BK.busy.img[i] = false;
  renderPanels(); saveDraft();
}

function drawAiMsg(panelEl, p) {          // 立刻把状态写进格子(重绘前也能看到)
  const m = panelEl.querySelector('.ai-pmsg');
  if (m) m.textContent = p.aiMsg || '';
}

function augmentPanels() {
  $$('#panel-grid .panel').forEach(el => {
    const i = +el.dataset.i, p = G.panels[i] || {};
    const acts = el.querySelector('.panel-actions');
    if (!acts) return;
    let m = el.querySelector('.ai-pmsg');
    if (!m) { m = document.createElement('div'); m.className = 'smallmsg ai-pmsg'; el.appendChild(m); }
    m.textContent = p.aiMsg || '';
    if (acts.querySelector('.act-aipaint')) return;      // 已经加过按钮
    const b1 = document.createElement('button');
    b1.className = 'btn btn-mini act-polish';
    b1.textContent = '✨ 帮我把提示词写具体';
    const b2 = document.createElement('button');
    b2.className = 'btn btn-mini btn-primary act-aipaint';
    b2.textContent = '🖼️ AI 画这格';
    acts.appendChild(b1); acts.appendChild(b2);
  });
}
function showAiImages() {
  $$('#panel-grid .panel').forEach(el => {
    const p = G.panels[+el.dataset.i];
    const box = el.querySelector('.svgbox');
    if (p && p.img && box && !box.querySelector('img')) {
      box.innerHTML = '<img src="' + esc(p.img) + '" alt="AI 画面" style="width:100%;height:100%;object-fit:cover;display:block">' +
        '<span class="ai-pic">🎨 AI 画的</span>';
    }
  });
}

/* ============================================================
   ⑥ 首映礼:Seedance 出片 + GLM-TTS 配音
   ============================================================ */
function imgToDataUrl(src, w, h, quality) {
  return new Promise(resolve => {
    const im = new Image();
    let done = false; const fin = v => { if (!done) { done = true; resolve(v); } };
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d');
        if (!cx) return fin('');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        fin(cv.toDataURL('image/jpeg', typeof quality === 'number' ? quality : 0.9));
      } catch (e) { fin(''); }
    };
    im.onerror = () => fin('');
    setTimeout(() => fin(''), 5000);
    im.src = src;
  });
}
function panelImageDataUrl(i) {           // 第 i 格的画面 → 给图生视频当首帧(按 16:9 出,和影片比例对齐)
  const p = G.panels[i] || G.panels[0];
  if (p && p.img) return imgToDataUrl(p.img, 1280, 720);
  const svg = (p && p.svg) || buildSVG(p || { cap: '故事' }, i);
  return imgToDataUrl('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg width="1280" height="720" ')), 1280, 720);
}
const filmWait = ms => new Promise(r => setTimeout(r, ms));

/* 拍一格:这一格的画面当首帧 + 这一句剧本当提示词 → 一段 5 秒镜头 */
async function shootSegment(seg, image, onTick) {
  const d = await bkPost('/api/video', {
    prompt: seg.prompt, image: image || undefined,
    duration: MAX_CLIP_SECONDS, resolution: '720p', ratio: '16:9',
  }, 240000);
  if (!d.taskId) throw new Error('没拿到任务号');
  lg('video', '第 ' + (seg.index + 1) + ' 格提交:' + d.taskId + ' · ' + d.model);
  const t0 = Date.now();
  let fails = 0;
  while (Date.now() - t0 < 600000) {
    await filmWait(6000);
    let g;
    try { g = await bkGet('/api/video/' + d.taskId, 40000); } catch (e) {
      if (++fails >= 5) throw new Error('查询生成进度失败:' + String(e.message || e));
      continue;
    }
    fails = 0;
    if (onTick) onTick(Math.round((Date.now() - t0) / 1000));
    if (g.status === 'succeeded' && g.videoUrl) {
      return { videoUrl: g.videoUrl, model: g.model || d.model, cost: g.cost || 0, seconds: Math.round((Date.now() - t0) / 1000) };
    }
    if (g.status === 'failed' || g.status === 'expired') {
      throw new Error('第 ' + (seg.index + 1) + ' 格生成失败:' + ((g.error && (g.error.message || g.error.code)) || g.status));
    }
  }
  throw new Error('第 ' + (seg.index + 1) + ' 格等太久了(超过 10 分钟)');
}

async function aiMakeFilm() {          /* 一条龙:每格一段镜头 → 按剧本顺序拼成一部 → 每段配自己那句旁白 */
  const btn = $('#btn-film-ai'), msg = $('#film-msg');
  const say = t => { if (msg) msg.textContent = t; };
  if (BK.busy.video) { say('⏳ 上一部还在生成,别急,好了会自己出现'); return; }
  if (!ready('video')) { say('❌ 影片模型没就绪(看顶部 AI 片场徽章);可以先点「🎬 本机录制(免费)」'); return; }
  if (BK.mod.video.reach === false) await bkRefresh();
  if (BK.mod.video && BK.mod.video.reach === false) {
    say('⛔ 这台电脑现在连不上火山方舟(影片服务 ' + BK.mod.video.net + ')。可以先点「🎬 本机录制(免费)」把剧本和分镜录成片子,或者检查网络/代理后再试。');
    return;
  }
  if (!G.panels.length) { say('❌ 还没有分镜,先回第 5 步'); return; }

  const cards = cardsOf().map(c => c.card);
  const { segments, dropped } = planSegments(G.panels.map(p => ({ cap: p.cap, cards, style: G.style })));
  if (!segments.length) { say('❌ 分镜是空的,先回第 5 步画一画'); return; }
  if (dropped) say('ℹ️ 分镜有 ' + G.panels.length + ' 格,这次先拍前 ' + segments.length + ' 格(拼接最多 ' + segments.length + ' 段)。');

  G.videoSegments = (G.videoSegments && typeof G.videoSegments === 'object') ? G.videoSegments : {};
  const todo = pendingSegments(segments, G.videoSegments);
  const reuse = segments.length - todo.length;
  const est = estimateFilm({ count: todo.length });
  const quota = BK.usage.videoUnlimited
    ? '今天已经拍了 ' + (BK.usage.videosToday || 0) + ' 段(服务器没设限额)'
    : '今日视频额度:已用 ' + (BK.usage.videosToday || 0) + ' / ' + BK.usage.videoLeft;

  if (todo.length) {
    const okGo = confirm('这部片有 ' + segments.length + ' 格分镜。\n'
      + '要给每格各拍一段镜头,共 ' + todo.length + ' 次视频生成'
      + (reuse ? '(另外 ' + reuse + ' 段已经拍好了,不重复花钱)' : '') + '。\n'
      + '预计等 ' + est.waitLow + '~' + est.waitHigh + ' 秒,成片至少 ' + est.filmSecondsLeast + ' 秒。\n'
      + quota + '。\n\n现在开始吗?');
    if (!okGo) { say('👌 好,这次先不拍。草稿都还在。'); return; }
  } else if (!reuse) {
    say('❌ 没有可拍的镜头');
    return;
  }

  BK.busy.video = true;
  if (btn) { btn.disabled = true; btn.textContent = '🎬 拍片中…'; }
  const shots = Object.assign({}, G.videoSegments);
  const frames = {};
  const failed = [];
  const started = Date.now();
  try {
    say('⏳ ① 把每一格的画面准备成首帧…');
    for (const seg of segments) frames[seg.index] = await panelImageDataUrl(seg.index);

    const total = todo.length;
    let done = 0;
    const queue = todo.slice();
    const tick = () => { if (btn) btn.textContent = '🎬 拍片中 ' + done + '/' + total; };
    tick();
    const shootOne = async seg => {
      try {
        say('⏳ ② 正在拍第 ' + (seg.index + 1) + ' 格…(已完成 ' + done + '/' + total + ')');
        shots[seg.index] = await shootSegment(seg, frames[seg.index], sec => {
          say('⏳ 第 ' + (seg.index + 1) + ' 格拍了 ' + sec + ' 秒…(已完成 ' + done + '/' + total + ')');
        });
        lg('video', '第 ' + (seg.index + 1) + ' 格镜头好了(' + shots[seg.index].seconds + ' 秒)');
        G.videoSegments = Object.assign({}, shots);
        saveDraft();                     /* 断点续做:这一段已经花了钱,别丢 */
      } catch (e) {
        failed.push({ seg, why: String((e && e.message) || e) });
      } finally {
        done++;
        tick();
      }
    };
    const worker = async () => { while (queue.length) await shootOne(queue.shift()); };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, total)) }, worker));

    /* 没拍成的再补一次,还不行就降级成静帧 */
    const retry = failed.splice(0, failed.length);
    for (const f of retry) {
      try {
        shots[f.seg.index] = await shootSegment(f.seg, frames[f.seg.index]);
        G.videoSegments = Object.assign({}, shots);
        saveDraft();
        lg('video', '第 ' + (f.seg.index + 1) + ' 格重试成功');
      } catch (e) {
        failed.push(f);
      }
    }

    const got = segments.filter(s => shots[s.index] && shots[s.index].videoUrl);
    if (!got.length) throw new Error('每一格都没拍成' + (failed[0] ? '(' + failed[0].why + ')' : ''));
    const degraded = segments.length - got.length;
    const cost = Math.round(got.reduce((sum, s) => sum + (shots[s.index].cost || 0), 0) * 1000) / 1000;

    say('⏳ ③ 正在按剧本顺序把 ' + segments.length + ' 段拼成一部片子(约 10~30 秒)…');
    const payload = segments.map(seg => {
      const shot = shots[seg.index];
      return (shot && shot.videoUrl)
        ? { videoUrl: shot.videoUrl, line: seg.line }
        : { image: frames[seg.index], line: seg.line };   /* 没拍成的格子用这一格的图顶上 */
    });
    const titleBox = $('#in-title');
    const m = await bkPost('/api/film/stitch', { segments: payload, title: (titleBox && titleBox.value) || '' }, 600000);
    if (!m || !m.url) throw new Error('拼接没有返回片子');
    lg('video', '成片拼好了:' + m.segments + ' 段 · ' + m.seconds + ' 秒');

    releaseVideoUrl();                     /* 换成服务端成片前,先放掉本机录制的 blob */
    G.videoUrl = m.url;
    G.videoModel = '逐格拍片 ' + got.length + '/' + segments.length + ' 段 AI 镜头 + ' + modelOf('tts') + ' 配音';
    G.filmMs = Date.now() - started;
    G.filmSeconds = Number(m.seconds) || 0;
    G.videoCost = cost;
    renderPlayer();
    const eye = m.seconds ? ' · ' + Math.round(m.seconds) + ' 秒' : '';
    say('✅ 影片好了!就在上面播放(' + got.length + '/' + segments.length + ' 段 AI 镜头' + eye + ' · 约 ¥' + (cost || '-') + ')。'
      + (degraded ? '有 ' + degraded + ' 格没拍成,已经用这一格的画面顶上,片子是完整的。' : '')
      + '看完记得往下起名字、写评论。');
    toast(degraded ? '🎥 影片好了(' + degraded + ' 格用画面顶上)' : '🎥 影片好了,先看片再起名字!');
    if (failed.length) lg('video', '这几格没拍成,已用静帧顶上:' + failed.map(f => '第' + (f.seg.index + 1) + '格').join('、'));
  } catch (e) {
    say('❌ ' + friendlyGenerationError('video', e.message).message);
    lg('video', '生成失败:' + String((e && e.message) || e).slice(0, 60));
  }
  BK.busy.video = false;
  if (btn) { btn.disabled = false; btn.textContent = '🎬 逐格拍片 + 配音'; }
}

function ensurePremUI() {
  const fb = $('#btn-film-ai');
  if (fb && !fb._wired) {
    fb._wired = true;
    fb.onclick = aiMakeFilm;
    if (!ready('video')) fb.title = '影片模型没就绪(见顶部 AI 片场)';
  }
  const mb = $('#btn-makefilm');
  if (mb && !mb._wired) {
    mb._wired = true;
    /* 本机录制:有 TTS 就用 GLM-TTS 当配音轨,没有就用浏览器朗读 */
    mb.onclick = async () => {
      const msg = $('#film-msg');
      if (!ready('tts')) {
        toast('离线模式:用浏览器自带朗读');
        try {
          const r = await makeFilm(x => { if (msg) msg.textContent = '⏳ ' + x; });
          if (msg) msg.textContent = '✅ 影片好了(' + r.pages + ' 页 · ' + G.filmSeconds + ' 秒 · 免费录制没有配音轨;想要旁白就用「🎬 逐格拍片」)';
          renderPlayer();
        } catch (e) { if (msg) msg.textContent = '❌ 本机录制暂时没有完成，稍等后再试；你的草稿还在。'; }
        return;
      }
      const b = $('#btn-makefilm'); b.disabled = true; const t = b.textContent; b.textContent = '🎙️ 配音 + 录制中…';
      try {
        const r = await makeFilmAI(x => { if (msg) msg.textContent = '⏳ ' + x; });
        if (msg) msg.textContent = '✅ 影片好了(' + r.pages + ' 页 · ' + Math.round(r.ms / 1000) + ' 秒 · ' + Math.round(r.size / 1024) + ' KB · 配音:' + modelOf('tts') + ')';
        renderPlayer(); toast('🎥 带 AI 配音的影片好了!');
      } catch (e) {
        if (msg) msg.textContent = '❌ 本机录制暂时没有完成，稍等后再试；你的草稿还在。';
      }
      b.disabled = false; b.textContent = t;
    };
  }
}

async function ttsBuffer(text, ctx) {
  const r = await fetch('/api/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: String(text || '').slice(0, 120) }),
  });
  if (!r.ok) throw new Error('配音失败 HTTP ' + r.status);
  return await ctx.decodeAudioData(await r.arrayBuffer());
}
async function makeFilmAI(onStep) {        // 用 GLM-TTS 当配音轨录一部真的能看的片子
  const step = typeof onStep === 'function' ? onStep : () => {};
  if (!G.panels.length) throw new Error('还没有分镜,先回第 5 步画画');
  if (!(window.MediaRecorder && document.createElement('canvas').captureStream)) throw new Error('这个浏览器不支持网页录像,请用 Edge 或 Chrome');
  const W = 1280, H = 800;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx2 = cv.getContext('2d');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !document.createElement('canvas').captureStream) throw new Error('这个浏览器不支持录音,请用 Edge 或 Chrome');
  const ac = new AC();
  const dest = ac.createMediaStreamDestination();
  await Promise.race([ac.resume ? ac.resume() : Promise.resolve(), new Promise(r => setTimeout(r, 500))]);
  step('① 请 GLM-TTS 配音(每页一句)…');
  const pages = [{ kind: 'cover', dur: 3.0, speak: (G.title || '我的电影') + '。导演' + G.director + '。' + (G.synopsis || synopsisText()) }]
    .concat(G.panels.map((p, i) => ({ kind: 'panel', dur: 3.2, cap: (p.cap || '').trim(), svg: p.svg, img: p.img, speak: (p.cap || '').trim() || ('第' + (i + 1) + '页'), idx: i })));
  const imgs = [], bufs = [];
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    step('① 配音 ' + (i + 1) + '/' + pages.length + '…');
    try { bufs.push(await ttsBuffer(pg.speak, ac)); } catch (e) { bufs.push(null); }
    if (pg.img) imgs.push(await imgOf(pg.img));
    else if (!pg.svg) imgs.push(null);
    else {
      const sized = pg.svg.replace('<svg ', '<svg width="640" height="400" ');
      imgs.push(await new Promise(res => {
        const im = new Image(); let done = false; const fin = v => { if (!done) { done = true; res(v); } };
        im.onload = () => fin(im); im.onerror = () => fin(null); setTimeout(() => fin(null), 3000);
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
      }));
    }
  }
  const stream = cv.captureStream(24);
  dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? { mimeType: 'video/webm;codecs=vp9,opus' } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = Date.now();
  let recordedMs = 0;
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    step('② 录像中 ' + (i + 1) + '/' + pages.length + '…');
    const ab = bufs[i];
    const dur = Math.max(pg.dur * 1000, ab ? ab.duration * 1000 + 400 : 0);
    recordedMs += dur;
    if (ab) { const src = ac.createBufferSource(); src.buffer = ab; src.connect(dest); src.connect(ac.destination); src.start(); }
    const s0 = Date.now();
    while (true) {
      const el = Date.now() - s0, prog = Math.min(1, el / dur);
      drawPage(ctx2, pg, imgs[i], prog, W, H);
      if (el >= dur) break;
      await sleep(40);
    }
  }
  await sleep(300);
  rec.stop(); await stopped;
  try { ac.close(); } catch (e) {}
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  releaseVideoUrl();
  G.videoUrl = url; G.filmMs = Date.now() - t0; G.videoModel = '本机录制 + ' + modelOf('tts') + ' 配音'; G.videoCost = 0;
  G.filmSeconds = Math.round(recordedMs / 1000);      /* 用实际录到的长度,旁白比画面长时也不会报短 */
  return { url, ms: G.filmMs, pages: pages.length, size: blob.size, blob };
}
const _imgCache = {};
const IMG_CACHE_MAX = 24;
function imgOf(src) {
  if (_imgCache[src]) return Promise.resolve(_imgCache[src]);
  if (Object.keys(_imgCache).length >= IMG_CACHE_MAX) {      /* 别让缓存无限长下去 */
    Object.keys(_imgCache).forEach(k => { delete _imgCache[k]; });
  }
  return new Promise(res => {
    const im = new Image();
    let done = false; const fin = v => { if (!done) { done = true; if (v) _imgCache[src] = v; res(v); } };
    im.crossOrigin = 'anonymous';
    im.onload = () => fin(im); im.onerror = () => fin(null); setTimeout(() => fin(null), 6000);
    im.src = src;
  });
}

/* ============================================================
   挂到游戏上(不修改 game.js 主逻辑)
   ============================================================ */
const _renderIdea = renderIdea;
renderIdea = function () { _renderIdea.apply(this, arguments); ensureIdeaUI(); };
const _renderStory = renderStory;
renderStory = function () { _renderStory.apply(this, arguments); ensureStoryUI(); };
const _renderPanels = renderPanels;
renderPanels = function () { _renderPanels.apply(this, arguments); augmentPanels(); showAiImages(); };
const _renderPrem = renderPrem;
renderPrem = function () { _renderPrem.apply(this, arguments); ensurePremUI(); };
const _renderPlayer = renderPlayer;
renderPlayer = function () {
  _renderPlayer.apply(this, arguments);
  const box = $('#film-player');
  if (box && G.videoUrl && G.videoModel) {
    const s = box.querySelector('.smallmsg');
    if (s && !s.dataset.m) { s.dataset.m = '1'; s.innerHTML += '<br>🎥 这条片子:<b>' + esc(G.videoModel) + '</b>' + (G.videoCost ? '(约 ¥' + G.videoCost + ')' : '(免费)'); }
  }
};
/* boot() 在上面已经跑过了(它比这些补丁早),所以草稿直接恢复到某一步时,
   那一步的补丁钩子不会执行 —— 重新刷新页面回到首映礼,按钮会没反应。这里补一次。 */
(function rehookRestoredStage() {
  if (!G.stage || G.stage === 'title') return;
  try {
    if (G.stage === 'idea') ensureIdeaUI();
    else if (G.stage === 'story') ensureStoryUI();
    else if (G.stage === 'board') { augmentPanels(); showAiImages(); }
    else if (G.stage === 'prem') ensurePremUI();
  } catch (e) { /* 补挂失败也不该挡住游戏 */ }
})();
document.addEventListener('click', e => {
  const pol = e.target.closest('.act-polish');
  if (pol) { aiPolish(pol.closest('.panel')); return; }
  const ap = e.target.closest('.act-aipaint');
  if (ap) { aiPaint(ap.closest('.panel')); return; }
  const go = e.target.closest('[data-go]');
  if (go && go.getAttribute('data-go') === 'sc-idea') setTimeout(autoSynopsis, 60);   // 进"讲想法"就自动写通顺
}, true);

bkBoot().then(() => {
  syncArchiveFromServer();
  if (BK.ok && ready('synopsis')) setTimeout(autoSynopsis, 300);
});
/* 关页面前把还没落盘的草稿写掉,免得最后一次输入丢掉 */
nativeDocument.addEventListener('visibilitychange', () => {
  if (nativeDocument.visibilityState === 'hidden' && draftTimer) saveDraft();
});

onNavigate(G.stage);
return {
  navigate(stage) {
    if (stage === 'title') { show('title'); return true; }
    return jumpTo(STEPS[stage]);
  },
  resume() { if (tryRestoreDraft()) onNavigate(G.stage); },
  dispose() {
    stopAuto();
    stopSpeak();
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
    controller.abort();
  }
};
}
