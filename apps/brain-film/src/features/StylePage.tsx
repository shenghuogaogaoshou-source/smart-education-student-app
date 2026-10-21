export function StylePage() { return (
<section id="sc-style" className="screen">
    <h2 className="screentitle">🎨 定画风</h2>
    <div className="tcard">
      <div className="bubble" id="style-bubble">🤖 我看了一遍你的故事,先挑一个最搭的画风给你……</div>
      <div id="style-recos" className="stylestage"></div>
      <div className="divider"><span>都不喜欢?自己写一种</span></div>
      <div className="actionbar">
        <input id="in-style-custom" type="text" maxLength={20} aria-label="自己写一种画风" placeholder="比如:水彩星空风 / 毛绒玩偶风" />
        <button id="btn-style-custom" className="btn btn-mini">就用这个画风</button>
        <span className="smallmsg" id="style-msg"></span>
      </div>
    </div>
    <div className="navrow">
      <button className="btn" data-go="sc-story">← 回去改剧本</button>
      <button id="btn-style2board" className="btn btn-big btn-primary" disabled>开始画分镜 →</button>
    </div>
  </section>
) }
