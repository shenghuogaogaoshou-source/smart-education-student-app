# 脑洞放映厅 · AI 接口与 Key 分工清单

> 给"换一台机器/换个部署"时用。**本文件不含真实 Key**——Key 全部在本机 `脑洞放映厅/.env` 里,
> 换地方时把那个文件(只有十几行)一起拷过去即可,或者照下面的字段名重新填。

---

## 一、Key ↔ 功能 ↔ 模型(一目了然)

| # | 功能(项目里的位置) | 厂商 | 模型 | `.env` 字段 | 大致费用 |
|---|---|---|---|---|---|
| 1 | **故事简介 / 写剧本 / 提示词润色** | 智谱 BigModel | `glm-5.2` | `ZHIPU_API_KEY` | ≈¥0.01/部 |
| 2 | **画分镜(文生图)** | 火山方舟 Ark | `doubao-seedream-5-0-260128`(Seedream 5.0 Lite) | `ARK_API_KEY` | ≈¥0.25/张 |
| 3 | **生成影片(图生视频)** | 火山方舟 Ark | `doubao-seedance-2-0-mini-260615`(未开通时自动降级到 1.0 系列) | `VIDEO_API_KEY` | ≈¥1.5/条(5 秒) |
| 4 | **视频配音(TTS)** | 智谱 BigModel | `glm-tts` | `VOICE_API_KEY` | ¥2/万字符 |

> 备注:3 和 2 是**两个不同的火山方舟 Key**(账号相同,按用途分开);1 和 4 是**两个不同的智谱 Key**。
> 项目里 Key 只在服务器端读取,浏览器/App 永远拿不到。

---

## 二、接口规格(照着写就能连)

### 1) 智谱 BigModel · 对话(简介 / 剧本 / 润色)

```
POST https://open.bigmodel.cn/api/paas/v4/chat/completions
Header: Authorization: Bearer <ZHIPU_API_KEY>
Body:
{
  "model": "glm-5.2",
  "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}],
  "temperature": 0.9,
  "max_tokens": 700,
  "stream": false,
  "thinking": {"type": "disabled"}          ← 关键!不关思考会等 30 秒以上、还吃光 token
}
返回: choices[0].message.content
```

### 2) 智谱 BigModel · 语音合成(配音)

```
POST https://open.bigmodel.cn/api/paas/v4/audio/speech
Header: Authorization: Bearer <VOICE_API_KEY>
Body: { "model": "glm-tts", "input": "要读的文字(≤300字)", "voice": "female", "speed": 1.0, "response_format": "wav" }
返回: 二进制音频(wav)
可选音色: female / male / tongtong / chuichui / xiaochen / jam / kazi / douji / luodo
注意: 只支持 wav 和 pcm,不支持 mp3
```

### 3) 火山方舟 · 文生图(画分镜)

```
POST https://ark.cn-beijing.volces.com/api/v3/images/generations
Header: Authorization: Bearer <ARK_API_KEY>
Body:
{
  "model": "doubao-seedream-5-0-260128",
  "prompt": "蜡笔涂鸦风格:圆滚滚的小鲸鱼在海底理发店门口…整张图不出现任何文字",
  "size": "2560x1440",                 ← 必须 ≥ 3686400 像素(2560x1440 正好),否则报错
  "response_format": "b64_json",
  "watermark": true,
  "negative_prompt": "文字,字母,数字,招牌,标语,商标,水印"
}
返回: data[0].b64_json(或 url)
```

### 4) 火山方舟 · 图生视频(生成影片)

```
① 提交任务
POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
Header: Authorization: Bearer <VIDEO_API_KEY>
Body:
{
  "model": "doubao-seedance-2-0-mini-260615",
  "content": [
    { "type": "text",  "text": "儿童动画:小鲸鱼在海底理发店给海浪剪短发。镜头平稳 --resolution 720p --ratio 16:9 --duration 5" },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,……" } }     ← 首帧图,可省略(纯文生视频)
  ]
}
返回: { "id": "cgt-2026…" }

② 每 6 秒轮询
GET  https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
返回: { "status": "running|succeeded|failed", "content": { "video_url": "https://…mp4" }, "usage": { "completion_tokens": 103818 } }
计费: 按 token,5 秒 720p ≈ 10.4 万 token ≈ ¥1.5
```

**模型可用性自查**(任何一把火山 Key):
```
GET https://ark.cn-beijing.volces.com/api/v3/models      Header: Authorization: Bearer <Key>
```
`doubao-seedance-2-0-mini-260615` 目前**未开通**(会返回 `ModelNotOpen`),需要去火山方舟控制台 →「开通管理」点开通;
项目里已做**自动降级链**:`2-0-mini → 2-0-fast → 1-0-pro-fast-251015 → 1-0-pro-250528`,哪个通就用哪个。

---

## 三、换一个地方连接(两种方式)

### 方式 A:只把"另一个地方"当客户端(最省事,Key 不用动)

后端起在**原来这台电脑**上,另一台设备只负责显示:

```
电脑:  launch.ps1 -Lan            (或双击 启动手机模式.cmd)
另一台: 浏览器打开  http://<电脑IP>:5174/     ← 窗口启动时会打印这个地址
```

前端所有 AI 请求都打到同一台机器上的 `/api/*`,Key 一直留在服务器。手机端不需要装 App。

### 方式 B:把后端整体搬过去

```
必备: Python 3.8+(零依赖,不用 pip 装东西) · Node 20+(跑 Vite) · ffmpeg(拼接带配音的影片要用)
要拷贝的东西:
    脑洞放映厅/server.py          后端(托管网页 + 代理 AI + 作品库 SQLite)
    脑洞放映厅/src/  css/  index.html  package.json  vite.config.ts   前端
    脑洞放映厅/.env               ← Key 都在这里(换网络要改下面的 HTTPS_PROXY)
启动:  npm install && launch.ps1       (只开后端: python server.py --port 8766)
```

`.env` 里的字段(照抄字段名,填你自己确认过的值):

```ini
ZHIPU_API_KEY=            # 智谱:简介/剧本/润色
ZHIPU_MODEL=glm-5.2
ARK_API_KEY=              # 火山:画分镜
ARK_MODEL=doubao-seedream-5-0-260128
ARK_SIZE=2560x1440
VIDEO_API_KEY=            # 火山:生成影片
VIDEO_MODEL=doubao-seedance-2-0-mini-260615
VOICE_API_KEY=            # 智谱:配音(留空则复用 ZHIPU_API_KEY)
VOICE_MODEL=glm-tts
VOICE_VOICE=female
VOICE_SPEED=1.0
HTTPS_PROXY=              # 见下方"网络"一节
```

---

## 四、网络(重要,换地方最容易卡在这)

- **原来这台电脑**:直连不了 `ark.cn-beijing.volces.com`(DNS 解析失败),必须走本机代理
  `HTTPS_PROXY=http://127.0.0.1:7890`(Clash)。**开游戏前要确保代理在运行**;
  代理没开时,项目会自动退回直连并**只影响火山那两项**,智谱四项照常。
- **换到新网络**:先自测直连能不能通:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://ark.cn-beijing.volces.com/api/v3/models \
       -H "Authorization: Bearer <你的火山Key>"
  ```
  通 → `.env` 里 `HTTPS_PROXY=` 留空;不通 → 填新机器的代理地址。
- 顶部「AI 片场」徽章会实时标出哪一项网络不通(⛔),不用猜。

---

## 五、其他注意事项

1. **一律带 `thinking:{"type":"disabled"}`**(智谱 GLM-5.x 与火山 Seed 2.x):不关思考,等待从 4 秒涨到 36 秒,推理 token 还会把正文挤空。
2. **Seedream 尺寸必须 ≥3,686,400 像素**(建议 `2560x1440`);项目里做了失败自动换 `2K` 重试。
3. **出图提示词要明确"不出现任何文字"**:模型爱在画里写字,配上 `negative_prompt` 才干净。
4. **成本闸**(服务器侧硬闸):出图 ≤12 张/部 · 配音 ≤300 字/段 · 影片 ≤30 条/天 · 每 IP 240 请求/分钟。
5. **合成带配音的影片**:`/api/film` 会用本机 `ffmpeg` 下载 Seedance 片源 + 合成 GLM-TTS 旁白(画面不够长自动循环),输出 `data/films/*.mp4`。没有 ffmpeg 就只出无声画面。
6. **Key 安全**:`.env` 已在 `.gitignore`;`/.env`、`/data/bh.db` 走 HTTP 一律 404。分享项目前删掉 `.env` 和 `data/`。
7. 前端不要求 CORS:网页/App 直接加载服务器上的页面(同源);如果你要把前端放到别的域名,需要在 `server.py` 里给 `/api/*` 加 `Access-Control-Allow-Origin`。
