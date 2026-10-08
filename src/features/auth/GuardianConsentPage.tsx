import { useState } from 'react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

export function GuardianConsentPage({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [agreed, setAgreed] = useState(false)
  return (
    <AuthLayout title="监护人授权" subtitle="请监护人与学生一起阅读本页，再决定是否继续" backAction={<button className="text-back" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" size={18} />返回注册</button>}>
      <section className="auth-card consent-copy">
        <div><h2>我们会怎样使用信息</h2><p>正式产品需要使用学段、年级和必要账号信息提供适龄学习服务；页面初版不会上传这些信息。</p></div>
        <div><h2>AI、语音与相机</h2><p>未来启用前会单独说明用途并请求权限。学生可以拒绝授权，并继续使用不依赖相关权限的功能。</p></div>
        <div><h2>对话记录与长期记忆</h2><p>未来允许监护人与学生查看、关闭和删除同步内容；AI 对话不会进入成长画像。</p></div>
        <div><h2>作品与社区互动</h2><p>作品、点赞、收藏和留言会进行年龄适配与安全审核，并提供可见范围控制。</p></div>
        <div><h2>监护人的权利</h2><p>监护人可以查询、更正、撤回授权或申请删除未成年人的相关信息。</p></div>
        <label className="consent-check"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />我已与学生共同阅读并同意以上演示授权说明</label>
        <button className="primary-button" type="button" disabled={!agreed} onClick={onComplete}><ShieldCheck aria-hidden="true" size={18} />完成演示授权</button>
        <p className="prototype-note">本页不收集监护人身份证、验证码或真实联系方式；正式发布前需完成儿童隐私与法律合规审查。</p>
      </section>
    </AuthLayout>
  )
}
