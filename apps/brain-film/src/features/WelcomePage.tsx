export function WelcomePage() { return (
<section id="sc-title" className="screen active">
    <div id="arch-list" className="arch-wrap hidden"></div>
    <div className="hero">
      <h1>🎬 脑洞放映厅</h1>
      <p className="hero-sub">抽卡 → 讲想法 → 写剧本 → 定画风 → 画分镜 → <b>首映礼</b></p>
      <p className="hero-note">你想故事,AI 帮你画出来、拍出来。</p>
    </div>
    <div className="tcard">
      <h3 className="cardtitle">🎥 先认识一下</h3>
      <div className="field">
        <label htmlFor="in-director">你的名字(导演)</label>
        <input id="in-director" type="text" maxLength={12} placeholder="小导演" />
      </div>
      <div className="field">
        <label htmlFor="in-intern">AI 实习生叫什么</label>
        <input id="in-intern" type="text" maxLength={8} placeholder="小映" />
      </div>
    </div>
    <div className="navrow">
      <button id="btn-newfilm" className="btn btn-big btn-primary">🎬 开拍一部新片</button>
    </div>
  </section>
) }
