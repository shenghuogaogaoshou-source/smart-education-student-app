import { AppErrorBoundary } from './app/AppErrorBoundary'
import { installGameApiShim } from '@zhiya/works-bridge'
import './app/preferences.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initCustomModules } from './lib/customModules'

installGameApiShim('ai')

// 应用启动时加载已保存的自定义模块到运行时（moduleRegistry + evaluators）
// 否则刷新后画布上的自定义节点会因模块未注册而失效
initCustomModules()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(regs => regs.filter(reg => reg.scope === new URL('./', location.href).href).forEach(reg => reg.unregister()))
