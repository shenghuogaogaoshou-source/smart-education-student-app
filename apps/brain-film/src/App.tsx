import { useRef } from 'react'
import { StudioScreens } from './StudioScreens'
import { stageTitles, useStudioController } from './useStudioController'
import { AppPreferences } from './app/AppPreferences'

export default function App() {
  const root = useRef<HTMLDivElement>(null)
  const { stage, canBack, hasDraft, back, resume } = useStudioController(root)
  return <div className="phone-shell" ref={root}>
    <div className="app-navigation">
      <button onClick={back} disabled={!canBack} aria-label="返回上一页">‹ 返回</button>
      <strong aria-live="polite">{stageTitles[stage]}</strong>
      <AppPreferences storageKey="film-appearance" />
    </div>
    {stage === 'title' && hasDraft && <button className="resume-creation" onClick={resume}>继续上次创作 →</button>}
    <div className="app-viewport"><StudioScreens /></div>
  </div>
}
