export function StoryPage() { return (
<section id="sc-story" className="screen">
    <h2 className="screentitle">📜 写剧本</h2>
    <div id="stale-story" className="hidden"></div>
    <div className="tcard">
      <div id="bub-story" className="bubble">🤖 我在写剧本,稍等……</div>
      <h3 className="cardtitle" id="story-label">剧本(一行 = 一页分镜,可以直接改)</h3>
      <textarea id="ta-story" rows={10} maxLength={1600} aria-labelledby="story-label" placeholder="AI 会照着你的卡和想法写在这里,写完你可以随便改。"></textarea>
      <div className="actionbar">
        <button id="btn-ai-story" className="btn btn-mini btn-primary">✨ 让 AI 写剧本</button>
        <button id="btn-ai-regen" className="btn btn-mini">🔁 换一版</button>
        <button id="btn-story-save" className="btn btn-mini">💾 保存我改的剧本</button>
        <span className="smallmsg" id="story-hint"></span>
        <span id="ai-story-msg" className="smallmsg"></span>
      </div>
    </div>
    <div className="navrow">
      <button className="btn" data-go="sc-idea">← 回去补充想法</button>
      <button id="btn-story2style" className="btn btn-big btn-primary">下一步:定画风 →</button>
    </div>
  </section>
) }
