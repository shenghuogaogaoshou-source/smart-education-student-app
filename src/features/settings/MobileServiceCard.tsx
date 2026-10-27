import { Link2, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import {
  isNativeApp,
  isProductionNativeRelease,
  normalizeBackendOrigin,
  readMobileApiConfig,
  saveMobileApiOrigin,
} from '../../app/mobileApi'

export function MobileServiceCard() {
  const initial = readMobileApiConfig(false)
  const [apiOrigin, setApiOrigin] = useState(initial.apiOrigin)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)

  if (!isNativeApp() || isProductionNativeRelease()) return null

  const save = () => {
    const normalized = saveMobileApiOrigin(apiOrigin)
    setApiOrigin(normalized)
    setStatus('服务地址已保存')
    return normalized
  }

  const testConnection = async () => {
    const normalized = save()
    setTesting(true)
    try {
      const [aiResponse, brainResponse] = await Promise.all([
        fetch(`${normalized}/api/health`),
        fetch(`${normalized}/brain/api/health`),
      ])
      setStatus(aiResponse.ok && brainResponse.ok ? '云端学习服务连接正常' : '服务器已响应，但健康检查未通过')
    } catch {
      setStatus('连接失败，请检查云端地址和网络。')
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="settings-group mobile-service-card" aria-labelledby="mobile-service-title">
      <h2 id="mobile-service-title">移动端学习服务</h2>
      <div className="mobile-service-fields">
        <label>
          <span>服务根地址</span>
          <input
            aria-label="服务根地址"
            value={apiOrigin}
            onChange={(event) => setApiOrigin(event.target.value)}
            placeholder="https://api.example.com"
            inputMode="url"
          />
        </label>
      </div>
      <p>调试构建填写一个云端服务根地址，AI 与脑洞服务都会从这里自动分流。</p>
      <div className="mobile-service-actions">
        <button type="button" onClick={save}>保存服务地址</button>
        <button type="button" onClick={() => { void testConnection() }} disabled={testing || !normalizeBackendOrigin(apiOrigin)}>
          {testing ? <LoaderCircle size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
          测试连接
        </button>
      </div>
      {status && <p className="mobile-service-status" role="status">{status}</p>}
    </section>
  )
}
