export function IdeaPage() { return (
<section id="sc-idea" className="screen">
    <h2 className="screentitle">💭 讲想法</h2>
    <div className="tcard">
      <h3 className="cardtitle">📖 你的故事简介</h3>
      <div id="idea-synopsis" className="synopsis"></div>
      <div id="idea-syn-tag" className="smallmsg"></div>
      <div className="actionbar">
        <button id="btn-ai-syn" className="btn btn-mini btn-primary">✨ 让 AI 把简介写通顺</button>
        <button id="btn-ai-syn-again" className="btn btn-mini">🔁 换一版</button>
        <span id="ai-syn-msg" className="smallmsg"></span>
      </div>
    </div>
    <div className="tcard">
      <h3 className="cardtitle" id="idea-detail-label">✍️ 再补充一些具体内容</h3>
      <p className="smallmsg">可以写:主角和配角的身世 · 转折发生前的伏笔 · 后来想往哪儿发展 · 某个细节的来历……越具体,后面越好办。</p>
      <textarea id="ta-idea" rows={7} maxLength={1200} aria-labelledby="idea-detail-label" placeholder="例:大白其实是被海浪带大的;理发师从前也有名字,只是忘了;我希望最后大家在海边唱歌。"></textarea>
    </div>
    <div className="navrow">
      <button className="btn" data-go="sc-card">← 回去换卡</button>
      <button id="btn-idea2story" className="btn btn-big btn-primary">下一步:让 AI 写剧本 →</button>
    </div>
  </section>
) }
