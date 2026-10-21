export function StoryboardPage() { return (
<section id="sc-board" className="screen">
    <h2 className="screentitle">🎬 画分镜</h2>
    <div id="board-tip" className="boardtip"></div>
    <div id="panel-grid" className="panelgrid"></div>
    <div className="actionbar center">
      <button id="btn-addpanel" className="btn btn-mini">➕ 加一格</button>
      <button id="btn-delpanel" className="btn btn-mini">➖ 删一格</button>
      <button id="btn-paintall" className="btn btn-mini">🎨 全部重画</button>
    </div>
    <div className="navrow">
      <button className="btn" data-go="sc-style">← 回去改画风</button>
      <button id="btn-board2prem" className="btn btn-big btn-primary">装订成片,去首映礼 →</button>
    </div>
  </section>
) }
