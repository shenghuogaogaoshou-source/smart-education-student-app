import { useState, type FormEvent } from 'react'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { isGuardianConsentRequired } from './age'

type RegisterPageProps = {
  onBack: () => void
  onGuardianRequired: () => void
}

export function RegisterPage({ onBack, onGuardianRequired }: RegisterPageProps) {
  const [birthDate, setBirthDate] = useState('')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(0)

  function requestCode() {
    setCountdown(60)
    setMessage('页面初版未连接验证码服务，请继续体验表单结构')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!birthDate) {
      setMessage('请先填写出生年月')
      return
    }
    if (isGuardianConsentRequired(birthDate)) {
      onGuardianRequired()
      return
    }
    setMessage('演示注册信息已检查，可返回登录页体验')
  }

  return (
    <AuthLayout title="创建学习账号" subtitle="先了解你的学习阶段，再为你准备合适的体验" backAction={<button className="text-back" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" size={18} />返回登录</button>}>
      <form className="auth-card auth-form-grid" onSubmit={submit}>
        <label>选择年级<select required defaultValue=""><option value="" disabled>请选择</option>{['一年级','二年级','三年级','四年级','五年级','六年级','初一','初二','初三','高一','高二','高三'].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
        <label>出生年月<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></label>
        <label>学习账号／学习码<input required /></label>
        <label>手机号／邮箱<div className="input-with-icon"><Mail aria-hidden="true" size={18} /><input type="text" required /></div></label>
        <label>验证码<div className="code-row"><input required /><button type="button" onClick={requestCode}>{countdown ? `${countdown} 秒` : '获取验证码'}</button></div></label>
        <label>设置密码<input type="password" required autoComplete="new-password" /></label>
        {message && <p className="form-alert calm" role="status">{message}</p>}
        <button className="primary-button" type="submit"><ShieldCheck aria-hidden="true" size={18} />检查并继续</button>
      </form>
    </AuthLayout>
  )
}
