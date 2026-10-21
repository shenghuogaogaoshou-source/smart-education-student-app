import { useEffect, useReducer, useRef, useState } from 'react'

type Preferences = { contrast: 'soft' | 'clear'; reading: 'normal' | 'large' }
const initial: Preferences = { contrast: 'soft', reading: 'normal' }
function load(key: string): Preferences {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return { contrast: value?.contrast === 'clear' ? 'clear' : 'soft', reading: value?.reading === 'large' ? 'large' : 'normal' } } catch { return initial }
}
export function AppPreferences({ storageKey }: { storageKey: string }) {
  const [preferences, update] = useReducer((state: Preferences, patch: Partial<Preferences>) => ({ ...state, ...patch }), storageKey, load)
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    document.documentElement.dataset.contrast = preferences.contrast
    document.documentElement.dataset.reading = preferences.reading
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Preferences remain usable for this session. */ }
  }, [preferences, storageKey])
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  return <>
    <button type="button" className="appearance-trigger" aria-label="显示设置" onClick={() => setOpen(true)}>Aa</button>
    <dialog ref={dialog} className="preferences-dialog" aria-label="显示设置" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="preferences-heading"><h2>按你喜欢的方式阅读</h2><button type="button" onClick={() => setOpen(false)} aria-label="关闭显示设置">关闭</button></div>
      <fieldset><legend>文字大小</legend><button aria-pressed={preferences.reading === 'normal'} onClick={() => update({ reading: 'normal' })}>标准</button><button aria-pressed={preferences.reading === 'large'} onClick={() => update({ reading: 'large' })}>大字</button></fieldset>
      <fieldset><legend>外观</legend><button aria-pressed={preferences.contrast === 'soft'} onClick={() => update({ contrast: 'soft' })}>柔和</button><button aria-pressed={preferences.contrast === 'clear'} onClick={() => update({ contrast: 'clear' })}>清晰</button></fieldset>
      <p>自动记住你的选择，下次打开继续使用。</p>
    </dialog>
  </>
}
