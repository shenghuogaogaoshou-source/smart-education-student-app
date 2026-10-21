import { AppErrorBoundary } from './app/AppErrorBoundary'
import './app/preferences.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../css/style.css'
import './app.css'

/* 游戏主体是命令式 DOM(studioEngine 直接挂 onclick/listener),React 的错误边界收不到它抛的错。
   这里兜一层:真出意外时给用户一个能点的「重新打开」,而不是半死界面。 */
function reportCrash(why: string) {
  let bar = document.getElementById('bh-crash-bar')
  if (bar) return
  bar = document.createElement('div')
  bar.id = 'bh-crash-bar'
  bar.setAttribute('role', 'alert')
  bar.className = 'bh-crash-bar'
  const text = document.createElement('span')
  text.textContent = '😵 刚才那个操作出错了(作品会自动保存):' + why.slice(0, 60)
  const reload = document.createElement('button')
  reload.type = 'button'
  reload.textContent = '重新打开'
  reload.onclick = () => location.reload()
  bar.append(text, reload)
  document.body.appendChild(bar)
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', event => reportCrash(String(event.message || '未知错误')))
  window.addEventListener('unhandledrejection', event => {
    const reason = (event as PromiseRejectionEvent).reason as { message?: string } | string | undefined
    reportCrash(String((reason as { message?: string })?.message || reason || '未知错误'))
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(<AppErrorBoundary><App /></AppErrorBoundary>)
// Remove the old PWA worker so development always loads the current application.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.filter(reg => reg.scope === new URL('./', location.href).href).forEach(reg => reg.unregister())
  })
}
