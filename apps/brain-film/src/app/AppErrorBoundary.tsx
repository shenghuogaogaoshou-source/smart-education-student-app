import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Application view failed', error, info.componentStack) }
  render() {
    if (this.state.failed) return <main className="app-recovery" role="alert"><h1>这个页面暂时没能打开</h1><p>可以重新加载后继续。已保存在本机的内容会保留。</p><button onClick={() => location.reload()}>重新打开</button></main>
    return this.props.children
  }
}
