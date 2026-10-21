/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 纸张底色系：米黄水彩纸
        bg: '#f4ead5', // 主纸面
        surface: '#fdf6e3', // 卡纸奶油白
        'surface-2': '#f0e6cc', // 浅卡其
        'surface-3': '#e8dcc0', // 深一层卡其
        border: '#c9b896', // 浅墨线
        'border-bright': '#7a6a4a', // 深墨褐
        // 复古蜡笔 accent
        amber: {
          DEFAULT: '#d4a04a', // 姜黄/赭石
          bright: '#e8c878', // 柔黄
          dim: '#a87a2e',
        },
        cyan: {
          sig: '#6ba3c3', // 褪色靛蓝
        },
        green: {
          sig: '#8aab6e', // 橄榄绿
        },
        red: {
          sig: '#c66b5a', // 砖红
        },
        violet: {
          sig: '#a888c7', // 紫罗兰
        },
        orange: {
          sig: '#d4825a', // 砖橙
        },
        text: {
          DEFAULT: '#3d3422', // 深褐墨水
          dim: '#6b5d3f', // 中褐
          faint: '#9a8a6a', // 浅褐
        },
        ink: '#2a2415', // 最深墨色（漫画描边）
      },
      fontFamily: {
        // 手绘标题字体
        hand: ['Caveat', 'Patrick Hand', 'cursive'],
        // 正文手写体
        sans: ['"Patrick Hand"', 'Kalam', 'ui-sans-serif', 'sans-serif'],
        // 等宽（代码区/标签）
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // 卡拉姆（用于强调标签）
        kalam: ['Kalam', 'cursive'],
      },
      boxShadow: {
        // 漫画分镜硬阴影：无模糊、固定偏移
        comic: '4px 4px 0 0 #3d3422',
        'comic-sm': '3px 3px 0 0 #3d3422',
        'comic-amber': '4px 4px 0 0 #a87a2e',
        'comic-cyan': '4px 4px 0 0 #4a7a96',
        'comic-green': '4px 4px 0 0 #5e7a4a',
        'comic-red': '4px 4px 0 0 #8a4a3e',
        'comic-violet': '4px 4px 0 0 #6e5a8a',
        // 柔和水彩投影
        watercolor: '0 6px 18px -8px rgba(61,52,34,0.45)',
        node: '3px 3px 0 0 #3d3422, 0 0 0 2px #3d3422',
      },
      animation: {
        'pulse-slow': 'pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
        'flow-dash': 'flowDash 1.2s linear infinite',
        'wobble': 'wobble 0.4s ease-in-out',
      },
      keyframes: {
        flowDash: {
          to: { strokeDashoffset: '-18' },
        },
        wobble: {
          '0%,100%': { transform: 'rotate(-0.4deg)' },
          '50%': { transform: 'rotate(0.4deg)' },
        },
      },
      backgroundImage: {
        'paper-grain':
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.24 0 0 0 0 0.20 0 0 0 0 0.13 0 0 0 0.10 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
