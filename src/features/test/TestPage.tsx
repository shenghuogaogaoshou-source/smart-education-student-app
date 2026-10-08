import { BookOpen, Flame, Gem, Lock, Power } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import './test.css'

/* ===== AI 学习关卡数据 ===== */
type LevelStatus = 'completed' | 'current' | 'locked' | 'chest' | 'trophy'

type Level = {
  id: string
  status: LevelStatus
  title: string
  x: number // 0..100, 相对宽度百分比
  y: number // 0..100, 相对高度百分比（从下往上！底部是0，顶部是100）
}

const levelsElementary: Level[] = [
  { id: 'l1', status: 'completed', title: '认识AI朋友', x: 50, y: 5 },
  { id: 'l2', status: 'completed', title: 'AI的眼睛', x: 28, y: 18 },
  { id: 'l3', status: 'current', title: 'AI会聊天吗', x: 72, y: 32 },
  { id: 'l4', status: 'locked', title: 'AI的大脑', x: 22, y: 48 },
  { id: 'l5', status: 'locked', title: 'AI小画家', x: 78, y: 62 },
  { id: 'c1', status: 'chest', title: '宝箱', x: 50, y: 75 },
  { id: 'l6', status: 'locked', title: 'AI的耳朵', x: 28, y: 86 },
  { id: 't1', status: 'trophy', title: '小AI学家徽章', x: 50, y: 97 },
]

const levelsSecondary: Level[] = [
  { id: 'l1', status: 'completed', title: '什么是AI', x: 50, y: 5 },
  { id: 'l2', status: 'completed', title: '机器学习入门', x: 28, y: 18 },
  { id: 'l3', status: 'current', title: '神经网络探秘', x: 72, y: 32 },
  { id: 'l4', status: 'locked', title: '计算机视觉', x: 22, y: 48 },
  { id: 'l5', status: 'locked', title: '自然语言处理', x: 78, y: 62 },
  { id: 'c1', status: 'chest', title: '宝箱', x: 50, y: 75 },
  { id: 'l6', status: 'locked', title: '生成式AI', x: 28, y: 86 },
  { id: 't1', status: 'trophy', title: 'AI探索者徽章', x: 50, y: 97 },
]

/* 资源数据 */
const resources = [
  { icon: 'flame' as const, value: 6, label: '连续' },
  { icon: 'gem' as const, value: 710, label: '宝石' },
  { icon: 'bolt' as const, value: 25, label: '能量' },
]

/* ===== 云朵小羊吉祥物 SVG · 重绘版 =====
   遮挡顺序（从后到前）：
   腿 → 身体主块 → 头顶云朵凸起 → 头部脸盘 → 小角 → 眼睛 → 腮红 → 鼻子/嘴 → 胳膊（最前）
*/
function CloudLambMascot({
  variant,
  action = 'wave',
}: {
  variant: 'elementary' | 'secondary'
  action?: 'wave' | 'cheer'
}) {
  const isElem = variant === 'elementary'
  const bodyMain = isElem ? '#FFF5E8' : '#F0F4FF'
  const bodyMid = isElem ? '#FFE8D0' : '#DCE6F8'
  const bodyBottom = isElem ? '#FFD4B8' : '#C8D6F4'
  const cheek = isElem ? '#FFB8C8' : '#B8C8F0'
  const nose = isElem ? '#F0A070' : '#8AA0D8'
  const leg = isElem ? '#E8C89C' : '#B8C4E0'
  const tuft = isElem ? '#FFE4B8' : '#D8E0F8'
  const horn = isElem ? '#FFC89C' : '#C0CCE8'

  return (
    <div className="mascot-wrap">
      <div className="mascot-bubble" aria-hidden="true">嗨！一起学AI吧～</div>

      {/* viewBox 留足空间做动作 */}
      <svg viewBox="0 0 180 200" width="150" height="168" aria-hidden="true" className={`mascot-svg mascot-action-${action}`}>
        {/* ==== 地面投影 ==== */}
        <ellipse cx="90" cy="192" rx="44" ry="6" fill="rgba(0,0,0,0.08)" />

        {/* ================ 第 1 层：腿（最后面） ================ */}
        <g className="legs-group">
          {/* 左腿 */}
          <rect x="58" y="150" width="16" height="30" rx="8" fill={leg} className="leg leg-l" />
          {/* 右腿 */}
          <rect x="106" y="150" width="16" height="30" rx="8" fill={leg} className="leg leg-r" />
          {/* 脚掌 */}
          <ellipse cx="66" cy="182" rx="12" ry="5" fill={leg} />
          <ellipse cx="114" cy="182" rx="12" ry="5" fill={leg} />
        </g>

        {/* ================ 第 2 层：身体主云朵（在腿前方、头后方） ================ */}
        <g className="body-group">
          {/* 身体主体 — 圆润椭圆形 */}
          <ellipse cx="90" cy="130" rx="56" ry="44" fill={bodyMid} />
          {/* 云朵凸起（周围蓬松感） */}
          <circle cx="40" cy="118" r="22" fill={bodyMain} />
          <circle cx="52" cy="92" r="24" fill={bodyMain} />
          <circle cx="90" cy="78" r="26" fill={bodyMain} />
          <circle cx="128" cy="92" r="24" fill={bodyMain} />
          <circle cx="140" cy="118" r="22" fill={bodyMain} />
          <circle cx="144" cy="140" r="20" fill={bodyMid} />
          <circle cx="36" cy="140" r="20" fill={bodyMid} />
          {/* 底部阴影 — 立体感 */}
          <ellipse cx="90" cy="158" rx="48" ry="16" fill={bodyBottom} opacity="0.9" />
        </g>

        {/* ================ 第 3 层：头顶呆毛 / 云朵漩涡 ================ */}
        {isElem ? (
          // 小学端：向上的小呆毛
          <g className="tuft">
            <path d="M90 78 Q 94 50 86 28 Q 82 52 82 78 Z" fill={tuft} />
            <ellipse cx="86" cy="24" rx="10" ry="12" fill={tuft} />
          </g>
        ) : (
          // 中学端：云朵漩涡
          <g className="tuft">
            <circle cx="90" cy="52" r="18" fill={tuft} />
            <circle cx="76" cy="46" r="14" fill={tuft} />
            <circle cx="104" cy="46" r="14" fill={tuft} />
            <circle cx="90" cy="38" r="12" fill={tuft} />
          </g>
        )}

        {/* ================ 第 4 层：小羊角 ================ */}
        <ellipse cx="68" cy="78" rx="6" ry="14" fill={horn} transform="rotate(-18 68 78)" />
        <ellipse cx="112" cy="78" rx="6" ry="14" fill={horn} transform="rotate(18 112 78)" />

        {/* ================ 第 5 层：大眼睛（最醒目！） ================ */}
        <g className="eyes-group">
          {/* 左眼 */}
          <g className="eye eye-l">
            <ellipse cx="72" cy="108" rx="14" ry="17" fill="#2D2438" />
            {/* 高光 */}
            <ellipse cx="76" cy="102" rx="5" ry="6" fill="#FFFFFF" />
            <circle cx="71" cy="113" r="3" fill="#FFFFFF" />
          </g>
          {/* 右眼 */}
          <g className="eye eye-r">
            <ellipse cx="108" cy="108" rx="14" ry="17" fill="#2D2438" />
            <ellipse cx="112" cy="102" rx="5" ry="6" fill="#FFFFFF" />
            <circle cx="107" cy="113" r="3" fill="#FFFFFF" />
          </g>
        </g>

        {/* ================ 第 6 层：腮红（眼睛下方两侧） ================ */}
        <circle cx="56" cy="128" r="11" fill={cheek} opacity="0.7" />
        <circle cx="124" cy="128" r="11" fill={cheek} opacity="0.7" />

        {/* ================ 第 7 层：鼻子 + 嘴 ================ */}
        <ellipse cx="90" cy="128" rx="6" ry="4" fill={nose} />
        <path d="M 82 134 Q 90 142 98 134" stroke={nose} strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* ================ 第 8 层：胳膊（最前方，会遮挡身体侧面） ================ */}
        <g className="arm arm-l">
          <ellipse cx="26" cy="128" rx="10" ry="18" fill={bodyMid} transform="rotate(30 26 128)" />
          {/* 爪子 */}
          <circle cx="20" cy="140" r="8" fill={bodyMain} />
        </g>
        <g className="arm arm-r">
          <ellipse cx="154" cy="128" rx="10" ry="18" fill={bodyMid} transform="rotate(-30 154 128)" />
          <circle cx="160" cy="140" r="8" fill={bodyMain} />
        </g>
      </svg>
    </div>
  )
}

/* ===== 真正的卡通 3D 圆柱币（薄版！） ===== */
function Coin3D({ status, title }: { status: 'completed' | 'current' | 'locked'; title?: string }) {
  const isCurrent = status === 'current'
  const label = `${title ?? ''} · ${status === 'current' ? '当前关卡' : status === 'completed' ? '已完成' : '未解锁'}`

  return (
    <button type="button" className={`level-coin level-coin-svg level-${status}`} aria-label={label}>
      <svg viewBox="0 0 100 56" className="coin-svg" role="img" aria-hidden="true">
        {/* 1. 地面投影 */}
        <ellipse className="c-ground" cx="50" cy="52" rx="38" ry="4" />

        {/* 2. 底面椭圆（贴近，薄！） */}
        <ellipse className="c-bottom" cx="50" cy="44" rx="36" ry="8" />

        {/* 3. 侧面厚度带（薄！只有 14px 高） */}
        <rect className="c-side-mid" x="14" y="30" width="72" height="14" />
        {/* 侧面衔接圆角（让顶底过渡自然，不是硬切） */}
        <path className="c-side-l" d="M14 30 Q 10 37 14 44 L14 30 Z" />
        <path className="c-side-r" d="M86 30 Q 90 37 86 44 L86 30 Z" />
        <rect className="c-side-bottom-stripe" x="14" y="40" width="72" height="4" />

        {/* 4. 顶面椭圆（主视觉） */}
        <ellipse className="c-face" cx="50" cy="30" rx="36" ry="8" />

        {/* 5. 顶面高光 */}
        <ellipse className="c-shine" cx="42" cy="27" rx="18" ry="3.5" />

        {/* 6. 图标 */}
        {status === 'completed' && (
          <path className="c-icon c-icon-check" d="M34 30 L44 37 L66 19" />
        )}
        {status === 'current' && (
          <g className="c-icon c-icon-book" transform="translate(50 30)">
            <path d="M-13 -9 L-13 11 L13 11 L13 -9 Z" />
            <path d="M-9 -7 L0 -5 L9 -7" />
            <path d="M0 -5 L0 11" />
          </g>
        )}
        {status === 'locked' && (
          <g className="c-icon c-icon-lock" transform="translate(50 30)">
            <rect x="-8" y="-1" width="16" height="11" rx="2.2" />
            <path d="M-6 -1 Q-6 -11 0 -11 Q6 -11 6 -1" />
            <circle cx="0" cy="4" r="1.3" />
          </g>
        )}
      </svg>

      {isCurrent && <div className="current-ring" />}
      {isCurrent && <div className="current-glow" />}
    </button>
  )
}

/* ===== 关卡节点渲染 ===== */
function LevelNode({ level, index }: { level: Level; index: number }) {
  // 计算路径方向（左右交错）
  const offsetSide = index % 2 === 0 ? 'left' : 'right'

  if (level.status === 'chest') {
    return (
      <div
        className={`level-node chest-node ${offsetSide}`}
        style={{ left: `${level.x}%`, bottom: `${level.y}%` }}
      >
        <div className="level-shadow-chest" />
        <div className="level-chest" aria-label={`${level.title} 节点`}>
          <svg viewBox="0 0 64 64" width="56" height="56">
            {/* 宝箱主体 */}
            <rect x="8" y="26" width="48" height="30" rx="4" className="chest-body" />
            <rect x="8" y="14" width="48" height="20" rx="10" className="chest-lid" />
            {/* 锁 */}
            <rect x="28" y="26" width="8" height="14" rx="2" className="chest-lock" />
            <circle cx="32" cy="32" r="2" className="chest-lock-hole" />
            {/* 金色装饰条 */}
            <rect x="8" y="24" width="48" height="4" rx="2" className="chest-band" />
          </svg>
        </div>
      </div>
    )
  }

  if (level.status === 'trophy') {
    return (
      <div
        className={`level-node trophy-node ${offsetSide}`}
        style={{ left: `${level.x}%`, bottom: `${level.y}%` }}
      >
        <div className="level-shadow-trophy" />
        <div className="level-trophy" aria-label={`${level.title} 节点`}>
          <svg viewBox="0 0 64 64" width="58" height="62">
            {/* 奖杯主体 */}
            <path d="M 14 14 Q 14 36 32 40 Q 50 36 50 14 Z" className="trophy-cup" />
            {/* 把手 */}
            <path d="M 14 20 Q 4 22 6 32 Q 8 38 18 36" className="trophy-handle" />
            <path d="M 50 20 Q 60 22 58 32 Q 56 38 46 36" className="trophy-handle" />
            {/* 底座 */}
            <rect x="20" y="42" width="24" height="6" rx="2" className="trophy-base" />
            <rect x="16" y="48" width="32" height="6" rx="2" className="trophy-foot" />
            {/* 高光 */}
            <ellipse cx="24" cy="22" rx="4" ry="10" className="trophy-shine" />
          </svg>
        </div>
      </div>
    )
  }

  // 普通关卡节点（完成 / 当前 / 锁定）
  return (
    <div
      className={`level-node circle-node ${offsetSide} level-${level.status}`}
      style={{ left: `${level.x}%`, bottom: `${level.y}%` }}
    >
      {/* 地面投影 */}
      <div className="level-shadow-circle" />
      {/* 3D 圆柱币 */}
      <Coin3D status={level.status} title={level.title} />
      {/* 关卡名称 */}
      <span className="level-label">{level.title}</span>
    </div>
  )
}

/* ===== 主组件 ===== */
export function TestPage() {
  const { state } = useAppState()
  const levels = state.stage === 'elementary' ? levelsElementary : levelsSecondary

  // 构造 SVG 曲线路径：按索引顺序连接所有关卡中心
  const pathD = levels.map((lv, i) => {
    const cx = lv.x
    const cy = 100 - lv.y // SVG y 轴从上往下
    if (i === 0) return `M ${cx} ${cy}`
    const prev = levels[i - 1]
    const px = prev.x
    const py = 100 - prev.y
    // 用平滑曲线：控制点在两点之间的 y 方向偏移
    const cmy = (cy + py) / 2
    return ` Q ${px} ${cmy}, ${cx} ${cy}`
  }).join(' ')

  return (
    <div className="test-page">
      {/* 顶部区：章节标题 + 资源 */}
      <header className="test-header">
        <div className="test-unit">
          <span className="unit-num">
            {state.stage === 'elementary' ? '第 3 章' : 'Unit 3'}
          </span>
          <h2>{state.stage === 'elementary' ? 'AI 小博士养成记' : 'AI Literacy Journey'}</h2>
        </div>
        <div className="resource-row">
          {resources.map((r) => (
            <div key={r.icon} className="chip">
              <span className={`chip-icon chip-${r.icon}`}>
                {r.icon === 'flame' && <Flame aria-hidden="true" size={16} />}
                {r.icon === 'gem' && <Gem aria-hidden="true" size={16} />}
                {r.icon === 'bolt' && <Power aria-hidden="true" size={16} />}
              </span>
              <span className="chip-val">{r.value}</span>
            </div>
          ))}
        </div>
      </header>

      {/* 关卡地图区 */}
      <section className="level-map" aria-label="闯关地图">
        {/* 装饰背景：光晕 */}
        <div className="map-bg-glow map-glow-1" aria-hidden="true" />
        <div className="map-bg-glow map-glow-2" aria-hidden="true" />

        {/* SVG 路径连线 */}
        <svg
          className="map-path-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="pathStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--path-c1)" />
              <stop offset="100%" stopColor="var(--path-c2)" />
            </linearGradient>
          </defs>
          <path
            d={pathD}
            fill="none"
            stroke="url(#pathStroke)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeDasharray="1.5 1"
            className="map-path-line"
          />
        </svg>

        {/* 关卡节点 */}
        {levels.map((lv, i) => (
          <LevelNode key={lv.id} level={lv} index={i} />
        ))}

        {/* 云朵小羊吉祥物 × 2 —— 对角放置，不同动作，远离所有关卡 */}
        <div className="mascot-container mascot-bottom-left" aria-label={`${state.stage === 'elementary' ? '小学端' : '中学端'}左下吉祥物`}>
          <CloudLambMascot variant={state.stage} action="wave" />
        </div>
        <div className="mascot-container mascot-top-right" aria-label={`${state.stage === 'elementary' ? '小学端' : '中学端'}右上吉祥物`}>
          <CloudLambMascot variant={state.stage} action="cheer" />
        </div>
      </section>
    </div>
  )
}


