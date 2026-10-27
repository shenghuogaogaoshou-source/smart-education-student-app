import { Link2, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import {
  isNativeApp,
  normalizeBackendOrigin,
  readMobileApiOrigins,
  saveMobileApiOrigins,
} from '../../app/mobileApi'

export function MobileServiceCard() {
  const initial = readMobileApiOrigins(isNativeApp())
  const [aiOrigin, setAiOrigin] = useState(initial.aiOrigin)
  const [brainOrigin, setBrainOrigin] = useState(initial.brainOrigin)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)

  if (!isNativeApp()) return null

  const save = () => {
    const normalized = saveMobileApiOrigins(aiOrigin, brainOrigin)
    setAiOrigin(normalized.aiOrigin)
    setBrainOrigin(normalized.brainOrigin)
    setStatus('服务地址已保存')
    return normalized
  }

  const testConnection = async () => {
    const normalized = save()
    setTesting(true)
    try {
      const [aiResponse, brainResponse] = await Promise.all([
        fetch(`${normalized.aiOrigin}/api/health`),
        fetch(`${normalized.brainOrigin}/api/health`),
      ])
      setStatus(aiResponse.ok && brainResponse.ok ? 'AI 与脑洞服务连接正常' : '服务器已响应，但健康检查未通过')
    } catch {
      setStatus('连接失败，请检查电脑服务、同一 Wi-Fi 和防火墙')
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="settings-group mobile-service-card" aria-labelledby="mobile-service-title">
      <h2 id="mobile-service-title">移动端学习服务</h2>
      <div className="mobile-service-fields">
        <label>
          <span>AI 服务地址</span>
          <input
            aria-label="AI 服务地址"
            value={aiOrigin}
            onChange={(event) => setAiOrigin(event.target.value)}
            placeholder="http://192.168.1.20:8787"
            inputMode="url"
          />
        </label>
        <label>
          <span>脑洞服务地址</span>
          <input
            aria-label="脑洞服务地址"
            value={brainOrigin}
            onChange={(event) => setBrainOrigin(event.target.value)}
            placeholder="http://192.168.1.20:8766"
            inputMode="url"
          />
        </label>
      </div>
      <p>填写运行智芽后端电脑的局域网地址，手机与电脑需连接同一网络。</p>
      <div className="mobile-service-actions">
        <button type="button" onClick={save}>保存服务地址</button>
        <button type="button" onClick={() => { void testConnection() }} disabled={testing || !normalizeBackendOrigin(aiOrigin) || !normalizeBackendOrigin(brainOrigin)}>
          {testing ? <LoaderCircle size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
          测试连接
        </button>
      </div>
      {status && <p className="mobile-service-status" role="status">{status}</p>}
    </section>
  )
}
