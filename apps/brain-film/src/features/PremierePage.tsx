export function PremierePage() { return (
<section id="sc-prem" className="screen">
    <h2 className="screentitle">🌟 首映礼 · 脑洞大放映</h2>
    <div id="stale-prem" className="hidden"></div>

    
    <div className="tcard">
      <h3 className="cardtitle">🎥 你的片子</h3>
      <p className="smallmsg">点一下,AI 会<b>按剧本一页一页拍</b>:每一格分镜各拍一段镜头,再按顺序拼成一部完整的片子,每段配它自己那句旁白。生完先看片,再往下起名字、写评论。</p>
      <div className="actionbar">
        <button id="btn-film-ai" className="btn btn-big btn-primary">🎬 逐格拍片 + 配音</button>
        <button id="btn-makefilm" className="btn">🎬 本机录制(免费)</button>
      </div>
      <div className="smallmsg" id="film-msg"></div>
      <div id="film-player" className="player hidden"></div>
    </div>

    
    <div className="tcard">
      <h3 className="cardtitle" id="film-title-label">🎞️ 给片子起名字</h3>
      <input id="in-title" type="text" maxLength={24} aria-labelledby="film-title-label" placeholder="比如:大白的海底理发店" />
    </div>

    
    <div className="tcard">
      <h3 className="cardtitle">💬 导演评论(你自己的想法最值钱)</h3>
      <div className="refl-row"><label className="refl-q" htmlFor="ta-r1">① 最满意的一幕是?</label><textarea id="ta-r1" rows={1} maxLength={80} placeholder="我最喜欢……"></textarea></div>
      <div className="refl-row"><label className="refl-q" htmlFor="ta-r2">② 还有哪里想改?</label><textarea id="ta-r2" rows={1} maxLength={80} placeholder="下次我想改……"></textarea></div>
      <div className="field">
        <label htmlFor="ta-statement">🎤 还想补充点什么(可选)</label>
        <textarea id="ta-statement" rows={3} maxLength={400}></textarea>
      </div>
    </div>

    
    <details className="tcard">
      <summary>🎞️ 翻页看每一页分镜(幕后:看 AI 怎么画的)</summary>
      <div id="film" className="film"></div>
      <div id="filmstrip" className="filmstrip"></div>
      <div className="actionbar center">
        <button id="btn-prev" className="btn btn-mini">⏮ 上一页</button>
        <span id="film-pos" className="filmpos"></span>
        <button id="btn-next" className="btn btn-mini">下一页 ⏭</button>
        <button id="btn-auto" className="btn btn-mini">▶️ 自动翻页</button>
        <button id="btn-voice" className="btn btn-mini">🔇 朗读关</button>
        <button id="btn-backstage" className="btn btn-mini">👀 幕后</button>
      </div>
      <div id="backstage" className="backstage hidden"></div>
    </details>

    
    <details className="tcard">
      <summary>🧾 创作过程记录(你的学习证据:抽了什么卡、改了几次提示词)</summary>
      <div id="log-list" className="loglist"></div>
    </details>

    <div className="navrow">
      <button className="btn" data-go="sc-board">← 回去改分镜</button>
      <button id="btn-save" className="btn btn-big btn-primary">📖 装订成册,存进作品库</button>
      <button id="btn-exportfilm" className="btn">⬇️ 导出这部</button>
      <button id="btn-print" className="btn">🖨️ 打印成片手册</button>
    </div>
  </section>
) }
