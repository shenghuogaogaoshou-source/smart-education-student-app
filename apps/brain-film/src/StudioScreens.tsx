import { memo } from 'react'
import { WelcomePage } from './features/WelcomePage'
import { CardsPage } from './features/CardsPage'
import { IdeaPage } from './features/IdeaPage'
import { StoryPage } from './features/StoryPage'
import { StylePage } from './features/StylePage'
import { StoryboardPage } from './features/StoryboardPage'
import { PremierePage } from './features/PremierePage'
export const StudioScreens = memo(function StudioScreens() {
  return <>


<div id="toast" className="toast hidden"></div>


<header id="topbar">
  <div className="topbar-in">
    <div className="brand"><span className="brand-emoji">🎬</span><span className="brand-name">脑洞放映厅</span><span className="brand-sub">幻想制片厂</span></div>
    <div id="ai-badge" className="ai-badge"></div>
    <div className="topbar-tools">
      <button id="btn-archive" className="btn btn-mini">📚 作品库 <b id="arch-count">0</b></button>
      <button id="btn-settings" className="btn btn-mini">⚙️ 设置</button>
      <button id="btn-help" className="btn btn-mini">❓ 怎么玩</button>
    </div>
  </div>
  <nav id="stepbar" className="stepbar" aria-label="创作步骤">
    <button type="button" className="step" data-step="1">1 抽脑洞卡</button>
    <button type="button" className="step" data-step="2">2 讲想法</button>
    <button type="button" className="step" data-step="3">3 写剧本</button>
    <button type="button" className="step" data-step="4">4 定画风</button>
    <button type="button" className="step" data-step="5">5 画分镜</button>
    <button type="button" className="step" data-step="6">6 首映礼</button>
  </nav>
</header>

<aside id="creation-guide" className="creation-guide hidden" aria-live="polite">
  <div className="creation-guide-main">
    <strong id="creation-guide-title"></strong>
    <span id="creation-guide-prompt"></span>
  </div>
  <small id="creation-guide-privacy"></small>
</aside>

<main className="stage">

  
  <WelcomePage />

  
  <CardsPage />

  
  <IdeaPage />

  
  <StoryPage />

  
  <StylePage />

  
  <StoryboardPage />

  
  <PremierePage />

</main>


<div id="m-settings" className="overlay hidden">
  <div className="modal">
    <h2>⚙️ 片场设置</h2>
    <div className="tcard">
      <h3 className="cardtitle">🎨 画师</h3>
      <p className="smallmsg">每格默认用「🖼️ AI 画这格」出图;点「🎨 重画这格」则用免费的程序化插画。</p>
      <div className="actionbar">
        <button id="wrong-on" className="btn btn-mini">☠️ 翻车时刻:开</button>
        <button id="wrong-off" className="btn btn-mini">😇 翻车时刻:关</button>
      </div>
      <p className="smallmsg">翻车时刻 = 提示词写得太糊时,程序化插画会故意画错,教孩子"把话说清楚"。</p>
    </div>
    <div className="tcard">
      <h3 className="cardtitle">🧹 数据</h3>
      <div className="actionbar">
        <button id="btn-clear-draft" className="btn btn-mini">清掉未完成的草稿</button>
        <button id="btn-clear-mine" className="btn btn-mini">清掉我自己加的卡</button>
        <button id="btn-clear-all" className="btn btn-mini">清空本机所有数据</button>
      </div>
      <div className="smallmsg" id="data-msg"></div>
    </div>
    <div className="navrow"><button id="btn-settings-close" className="btn btn-big">完成</button></div>
  </div>
</div>


<div id="m-help" className="overlay hidden">
  <div className="modal">
    <h2>❓ 怎么玩</h2>
    <p className="oneline">一句话:<b>你出点子,AI 出画面</b>,一起拍出一部能放映的片子。</p>
    <ol className="howto">
      <li><b>抽脑洞卡</b> —— 六个格子各抽一张。主角、场景、经过是<b>必抽</b>,配角、转折、其他可以跳过,也能自己加格子。</li>
      <li><b>讲想法</b> —— AI 把卡写成一段简介;你在下面补细节:身世、伏笔、想去的方向。</li>
      <li><b>写剧本</b> —— AI 照着卡和你的想法写草稿,一行就是一页;想改哪句直接改。</li>
      <li><b>定画风</b> —— 先看 AI 最推荐的那个,不喜欢就换别的,或者自己写一个。</li>
      <li><b>画分镜</b> —— 每页写清"谁·在哪里·做什么",点「🖼️ AI 画这格」就出图。</li>
      <li><b>首映礼</b> —— 点「🎬 生成影片 + 配音」出片 → 看片 → 起名字 → 写评论 → 存进作品库。</li>
    </ol>
    <p className="smallmsg">💡 中途想改前面任何一步,直接点顶部步骤条跳回去;<b>后面已经做好的内容不会丢</b>。</p>
    <div className="navrow"><button id="btn-help-close" className="btn btn-big">知道了</button></div>
  </div>
</div>


<div id="printRoot" className="print-only"></div>


  </>
})
