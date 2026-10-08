import { useState, type FormEvent } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [notice, setNotice] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    setNotice('页面初版未连接账号服务，密码不会被真实修改')
  }
  return (
    <AuthLayout title="重新设置密码" subtitle="验证学习账号后，设置一个容易记住但不容易猜到的新密码" backAction={<button className="text-back" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" size={18} />返回登录</button>}>
      <form className="auth-card auth-form-grid" onSubmit={submit}>
        <label>学习账号／学习码<input required /></label>
        <label>手机号／邮箱<input required /></label>
        <label>验证码<div className="code-row"><input required /><button type="button" onClick={() => setNotice('页面初版未连接验证码服务')}>获取验证码</button></div></label>
        <label>新密码<input type="password" required autoComplete="new-password" /></label>
        {notice && <p className="form-alert calm" role="status">{notice}</p>}
        <button className="primary-button" type="submit"><RotateCcw aria-hidden="true" size={18} />确认新密码</button>
      </form>
    </AuthLayout>
  )
}
