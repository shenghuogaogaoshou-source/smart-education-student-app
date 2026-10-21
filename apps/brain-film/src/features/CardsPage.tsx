export function CardsPage() { return (
<section id="sc-card" className="screen">
    <h2 className="screentitle">🎴 抽脑洞卡</h2>
    <p className="screentip">每个格子抽一张卡。<b>主角 / 场景 / 经过</b>是必抽的;配角、转折、道具可以不抽,也可以自己加格子。<br /><b>按住不放拖动</b>就能挪位置:按住<b>卡片</b>拖到别的格子,松手就换(那头空着就搬过去);按住<b>格子名</b>拖到想放的地方,整个格子连卡一起挪。可选卡右上角的 <b>✖</b> 可以丢掉这张卡。</p>
    <div className="tcard">
      <div id="slot-grid" className="slotgrid"></div>
      <div className="actionbar">
        <button id="btn-addslot" className="btn btn-mini">➕ 添加一个格子</button>
        <button id="btn-drawall" className="btn btn-mini">🎲 全部随机抽</button>
        <button id="btn-clearall" className="btn btn-mini">🧹 全部重抽</button>
      </div>
    </div>
    <div className="navrow">
      <button id="btn-card2idea" className="btn btn-big btn-primary">下一步:讲想法 →</button>
    </div>
  </section>
) }
