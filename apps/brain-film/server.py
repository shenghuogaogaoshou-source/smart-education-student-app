#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
脑洞放映厅 · 后端服务 v4(零依赖,只用 Python 标准库)

它做三件事:
  1) 托管前端(index.html / js / css)
  2) 代理四个 AI 能力(Key 只留在服务器,浏览器永远拿不到):
       写剧本 / 提示词润色  →  智谱 GLM-5.2
       画分镜               →  火山 Seedream 5.0 Lite
       生成影片             →  火山 Seedance(自动挑账号已开通的)
       视频配音             →  智谱 GLM-TTS
  3) 作品备份(SQLite):换电脑/清缓存也能取回

用法:
  python server.py                 # http://127.0.0.1:8766(只本机可访问,和 Vite 代理一致)
  python server.py --port 9000     # 换端口
  python server.py --lan           # 允许局域网访问(机房:学生机连老师这台)
  python server.py --no-ai         # 不代理 AI(纯离线课堂:剧本走整理模式、画面走程序化插画)

依赖:无。数据落在 ./data/。
"""
import argparse
import base64
import binascii
import json
import mimetypes
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.request
from contextlib import contextmanager
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

APP_VERSION = '5.1'
ARK_HOST = 'ark.cn-beijing.volces.com'
ZHIPU_HOST = 'open.bigmodel.cn'
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')
DB_PATH = os.path.join(DATA_DIR, 'bh.db')
LOG_PATH = os.path.join(DATA_DIR, 'server.log')
FILM_DIR = os.path.join(DATA_DIR, 'films')
START_TS = time.time()

# 单价(元)用于花费提示;实付以各厂商账单为准
PRICE = {'image': 0.25, 'tts_per_1k': 0.2, 'story_per_1k': 0.01}
# 视频模型:按"账号可能已开通"的顺序自动降级(未开通会返回 ModelNotOpen,不花钱)
VIDEO_MODELS_PREF = ['doubao-seedance-2-0-mini-260615', 'doubao-seedance-2-0-fast-260128',
                     'doubao-seedance-1-0-pro-fast-251015', 'doubao-seedance-1-0-pro-250528']
VIDEO_PRICE_PER_M = {'doubao-seedance-2-0-mini-260615': 14, 'doubao-seedance-2-0-fast-260128': 22,
                     'doubao-seedance-2-0-260128': 28, 'doubao-seedance-1-0-pro-fast-251015': 15,
                     'doubao-seedance-1-0-pro-250528': 15}
# 成本闸(服务器侧硬闸)
LIMIT_IMG_PER_WORK = 12
LIMIT_IMG_PER_DAY = 80          # 服务器侧兜底:防止脚本循环刷图烧钱;0 = 不限
LIMIT_TTS_CHARS = 300
LIMIT_VIDEO_PER_DAY = 30        # 默认值;.env 里 VIDEO_LIMIT_PER_DAY=0 表示不限额
LIMIT_REQ_PER_MIN = 240
MAX_WORK_BYTES = 25 * 1024 * 1024
MAX_FILM_SEGMENTS = 10          # 一部片子最多几段镜头(和前端 filmPlan.js 对齐)
FILM_W, FILM_H, FILM_FPS = 1280, 720, 24

NO_AI = False
ENV = {}
PROXY = ''          # 走代理时形如 http://127.0.0.1:7890


def log(*a):
    line = datetime.now().strftime('[%m-%d %H:%M:%S] ') + ' '.join(str(x) for x in a)
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        # Windows 的 GBK 终端打印 emoji 会抛异常；日志不能反过来打断清理/生成流程。
        encoding = getattr(sys.stdout, 'encoding', None) or 'utf-8'
        print(line.encode(encoding, 'replace').decode(encoding), flush=True)
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except OSError:
        pass


def safe_msg(msg, limit=200):
    """回给浏览器的错误信息里不要带本机绝对路径(会暴露用户名和目录结构)"""
    text = re.sub(r'[A-Za-z]:\\[^\s\'"]*', '<本机路径>', str(msg or ''))
    text = re.sub(r'/(?:home|Users|tmp|var)/[^\s\'"]*', '<本机路径>', text)
    return text[:limit]


# ------------------------------------------------ 配置
def load_env(path=None, environ=None):
    """加载本机配置；调用方可注入路径和环境以便测试，绝不记录敏感值。"""
    env = {}
    path = path or os.path.join(HERE, '.env')
    environ = os.environ if environ is None else environ
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith('#') or '=' not in s:
                    continue
                k, _, v = s.partition('=')
                k, v = k.strip(), v.strip()
                if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
                    v = v[1:-1]
                env[k] = v
    for k in ['ZHIPU_API_KEY', 'ZHIPU_MODEL', 'ARK_API_KEY', 'ARK_MODEL', 'ARK_SIZE',
              'VIDEO_API_KEY', 'VIDEO_MODEL', 'VOICE_API_KEY', 'VOICE_MODEL', 'VOICE_VOICE', 'VOICE_SPEED',
              'HTTPS_PROXY', 'HTTP_PROXY']:
        if environ.get(k):
            env[k] = environ[k]
    return env


def proxy_status_label(proxy):
    return '本机代理已配置' if proxy else '未配置代理'


_NET_CACHE = {}
_NET_WHY = {}
_NET_PROBING = {}


def _probe_once(host):
    ip = socket.gethostbyname(host)              # DNS
    s = socket.create_connection((ip, 443), timeout=3)
    s.close()


_PROXY_ALIVE = [0, 0.0]          # [是否活着, 检查时间]


def proxy_alive(ttl=20):
    """本机代理还在不在(开游戏前忘了开 Clash 的情况很常见)"""
    now = time.time()
    if now - _PROXY_ALIVE[1] < ttl:
        return bool(_PROXY_ALIVE[0])
    pa = _proxy_addr()
    ok = False
    if pa:
        try:
            s = socket.create_connection(pa, timeout=1.5)
            s.close()
            ok = True
        except Exception:
            ok = False
    _PROXY_ALIVE[0], _PROXY_ALIVE[1] = ok, now
    if not ok:
        log('⚠️ %s 但暂时连不上:火山(画分镜/影片)会不可用;智谱系列不受影响(直连)' % proxy_status_label(PROXY))
    return ok


def opener_for(host):
    """按主机选通道:火山走代理(本机直连不通),智谱等能直连的就直连。
       代理挂了就全部退回直连,免得把本来能用的功能也拖死。"""
    px = PROXY if (PROXY and host == ARK_HOST and proxy_alive()) else ''
    if px:
        return urllib.request.build_opener(urllib.request.ProxyHandler({'https': px, 'http': px}))
    return urllib.request.build_opener()


def _proxy_addr():
    if not PROXY:
        return None
    s = PROXY.split('://')[-1].rstrip('/')
    host, _, port = s.partition(':')
    try:
        return (host or '127.0.0.1', int(port or 7890))
    except ValueError:
        return ('127.0.0.1', 7890)


def net_probe(host, timeout=5):
    """探测上游能不能用:需要走代理的主机先看代理活没活;否则直连探 DNS + 443。"""
    if PROXY and host == ARK_HOST and proxy_alive():
        return True, ''
    box = {}

    def run():
        try:
            _probe_once(host)
            box['ok'] = True
        except Exception as e:
            box['ok'] = False
            box['why'] = '%s: %s' % (type(e).__name__, str(e)[:80])
    th = threading.Thread(target=run, daemon=True)
    th.start()
    th.join(timeout)
    if 'ok' not in box:
        return False, '探测超时(%ds):这台电脑的 DNS 或网络没响应' % timeout
    return box['ok'], box.get('why', '')


def net_ok(host, ttl=60, wait=True):
    """能不能连上某个上游。wait=False:没缓存就先让后台去探,立刻返回 None(不拖慢接口)"""
    now = time.time()
    hit = _NET_CACHE.get(host)
    if hit and now - hit[1] < ttl:
        return hit[0]

    def _bg(h):
        try:
            ok, why = net_probe(h)
            _NET_CACHE[h] = (ok, time.time(), why)
            _NET_WHY[h] = why
        finally:
            _NET_PROBING[h] = False

    if not wait:
        if not _NET_PROBING.get(host):
            _NET_PROBING[host] = True
            threading.Thread(target=_bg, args=(host,), daemon=True).start()
        return hit[0] if hit else None
    _bg(host)
    return _NET_CACHE.get(host, (False, 0, ''))[0]


def require_net(host, what):
    if not net_ok(host):
        hint = '请先打开本机代理软件' if (PROXY and host == ARK_HOST) else '请检查网络'
        raise ApiError('连不上%s:%s。%s;这一步也可以先用免费的做法顶一下。' % (what, host, hint), 503)


def cfg(key, fallback=''):
    return ENV.get(key) or fallback


def modules():
    """告诉前端:每个能力能不能用、用什么模型、网络通不通(不返回 Key)"""
    ark_video = cfg('VIDEO_API_KEY') or cfg('ARK_API_KEY')
    zp = net_ok(ZHIPU_HOST, wait=False)
    ak = net_ok(ARK_HOST, wait=False)
    return {
        'story': {'ready': bool(cfg('ZHIPU_API_KEY')) and not NO_AI, 'reach': zp, 'net': ZHIPU_HOST, 'model': cfg('ZHIPU_MODEL', 'glm-5.2')},
        'polish': {'ready': bool(cfg('ZHIPU_API_KEY')) and not NO_AI, 'reach': zp, 'net': ZHIPU_HOST, 'model': cfg('ZHIPU_MODEL', 'glm-5.2')},
        'synopsis': {'ready': bool(cfg('ZHIPU_API_KEY')) and not NO_AI, 'reach': zp, 'net': ZHIPU_HOST, 'model': cfg('ZHIPU_MODEL', 'glm-5.2')},
        'image': {'ready': bool(cfg('ARK_API_KEY')) and not NO_AI, 'reach': ak, 'net': ARK_HOST, 'model': cfg('ARK_MODEL', 'doubao-seedream-5-0-260128')},
        'video': {'ready': bool(ark_video) and not NO_AI, 'reach': ak, 'net': ARK_HOST, 'model': cfg('VIDEO_MODEL', VIDEO_MODELS_PREF[0])},
        'tts': {'ready': bool(cfg('VOICE_API_KEY') or cfg('ZHIPU_API_KEY')) and not NO_AI, 'reach': zp, 'net': ZHIPU_HOST, 'model': cfg('VOICE_MODEL', 'glm-tts')},
    }


# ------------------------------------------------ 数据库
@contextmanager
def db():
    """一次数据库会话:成功提交、出错回滚、无论如何都关连接
       (sqlite 的 with 只提交不关连接,文件会被一直占着,Windows 上尤其明显)"""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS works (
            id TEXT PRIMARY KEY, title TEXT, director TEXT, style TEXT,
            pages INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, payload TEXT);
        CREATE TABLE IF NOT EXISTS usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, module TEXT, model TEXT,
            chars INTEGER DEFAULT 0, cost REAL DEFAULT 0, ok INTEGER DEFAULT 1, err TEXT DEFAULT '');
        CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage(ts);
        ''')
        try:                                   # 老库补一列:记下这次调用对应哪个任务,并发时才不会记到别人头上
            conn.execute('ALTER TABLE usage ADD COLUMN ref TEXT')
        except sqlite3.Error:
            pass
        conn.execute('CREATE INDEX IF NOT EXISTS idx_usage_ref ON usage(ref)')


def log_usage(module, model, chars=0, cost=0.0, ok=1, err='', ref=''):
    try:
        with db() as conn:
            conn.execute('INSERT INTO usage(ts,module,model,chars,cost,ok,err,ref) VALUES(?,?,?,?,?,?,?,?)',
                         (datetime.now().isoformat(timespec='seconds'), module, model, chars, round(cost, 6), ok, err[:200], ref or ''))
    except sqlite3.Error as e:
        log('usage 记录失败:', e)


def record_video_cost(task_id, tokens, model):
    """把某个视频任务的 token 用量写回**它自己那一行**。
       首映礼会并发跑好几段,按"最新一行"更新会互相覆盖,所以必须按 ref=taskId 定位。"""
    cost = round(int(tokens or 0) / 1_000_000 * VIDEO_PRICE_PER_M.get(model, 15), 3)
    try:
        with db() as conn:
            conn.execute("UPDATE usage SET chars=?, cost=? WHERE module='video' AND ref=? AND ref<>''",
                         (int(tokens or 0), cost, task_id))
    except sqlite3.Error as e:
        log('usage 回写出错:', e)
    return cost


def videos_today():
    """今天真正提交成功的视频任务数(失败请求不计入,免得把额度白白用掉)"""
    with db() as conn:
        return conn.execute("SELECT COUNT(*) c FROM usage WHERE module='video' AND ok=1 AND ts>=?",
                            (datetime.now().strftime('%Y-%m-%d') + 'T00:00:00',)).fetchone()['c']


def video_day_limit():
    """每天最多提交多少条视频任务。0(或负数)= 不限额,仍然照常记账。"""
    raw = str(cfg('VIDEO_LIMIT_PER_DAY', str(LIMIT_VIDEO_PER_DAY))).strip()
    try:
        n = int(float(raw or LIMIT_VIDEO_PER_DAY))
    except (TypeError, ValueError):
        n = LIMIT_VIDEO_PER_DAY
    return max(0, n)


def images_today():
    """今天真正成功出图多少张(失败请求不计入)"""
    with db() as conn:
        return conn.execute("SELECT COUNT(*) c FROM usage WHERE module='image' AND ok=1 AND ts>=?",
                            (datetime.now().strftime('%Y-%m-%d') + 'T00:00:00',)).fetchone()['c']


_VIDEO_LOCK = threading.Lock()


def reserve_video_slot():
    """先占一个名额再提交:并发提交时"先查再写"会互相穿过,额度直接被超发"""
    lim = video_day_limit()
    with _VIDEO_LOCK:
        if lim and videos_today() >= lim:
            raise ApiError('今天的视频额度用完了(%d 条/天)' % lim, 429)
        log_usage('video', '-', ok=0, err='reserved')
        with db() as conn:
            row = conn.execute("SELECT MAX(id) i FROM usage WHERE module='video'").fetchone()
        return row['i'] if row else 0


def settle_video_slot(usage_id, model, tid):
    """任务真的提交成功了,才把这一个名额坐实(带上模型和任务号,后面按 ref 记账)"""
    try:
        with db() as conn:
            conn.execute('UPDATE usage SET model=?, ok=1, err=?, ref=? WHERE id=?',
                         (model, '', tid, usage_id))
    except sqlite3.Error as e:
        log('usage 占位回写出错:', e)


def release_video_slot(usage_id, why=''):
    try:
        with db() as conn:
            conn.execute("DELETE FROM usage WHERE id=? AND ok=0", (usage_id,))
    except sqlite3.Error as e:
        log('usage 占位清理出错:', e)


# ------------------------------------------------ 上游调用
class ApiError(Exception):
    def __init__(self, msg, status=502):
        super().__init__(msg)
        self.status = status


def _post(url, payload, headers, timeout=120, raw=False):
    req = urllib.request.Request(url, data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                                 method='POST', headers={'Content-Type': 'application/json', **headers})
    try:
        with opener_for(urlparse(url).hostname or '').open(req, timeout=timeout) as r:
            body = r.read()
            return (body, r.headers.get('Content-Type', '')) if raw else json.loads(body.decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')
        try:
            j = json.loads(detail)
            err = j.get('error') if isinstance(j.get('error'), dict) else {}
            detail = ((err.get('code') or '') + ' ' + (err.get('message') or '')).strip() \
                or j.get('message') or detail
        except ValueError:
            pass
        raise ApiError('上游接口 %s:%s' % (e.code, str(detail)[:200]), 502)
    except Exception as e:
        raise ApiError('连不上上游接口(%s)' % str(e)[:120])


def _get(url, headers, timeout=60):
    req = urllib.request.Request(url, headers=headers)
    try:
        with opener_for(urlparse(url).hostname or '').open(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise ApiError('查询失败 %s:%s' % (e.code, e.read().decode('utf-8', 'replace')[:150]))
    except Exception as e:
        raise ApiError('查询失败(%s)' % str(e)[:100])


def zhipu_chat(messages, max_tokens=900, temperature=0.9, module='story'):
    """智谱 GLM-5.2(写剧本 / 润色 / 简介)。GLM-5.x 默认开思考模式,必须关掉。"""
    if not cfg('ZHIPU_API_KEY'):
        raise ApiError('服务器没配智谱 Key', 503)
    if NO_AI:
        raise ApiError('这台服务器用 --no-ai 启动,不代理 AI 生成', 503)
    j = _post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        'model': cfg('ZHIPU_MODEL', 'glm-5.2'), 'messages': messages,
        'temperature': temperature, 'max_tokens': max_tokens, 'stream': False,
        'thinking': {'type': 'disabled'},
    }, {'Authorization': 'Bearer ' + cfg('ZHIPU_API_KEY')})
    text = ((j.get('choices') or [{}])[0].get('message', {}) or {}).get('content', '') or ''
    text = re.sub(r'</?(think|analysis)>.*?</\1>', '', text, flags=re.S).strip()
    if not text:
        raise ApiError('模型没有返回内容')
    chars = sum(len(str(m.get('content', ''))) for m in messages) + len(text)
    log_usage(module, cfg('ZHIPU_MODEL', 'glm-5.2'), chars=chars, cost=PRICE['story_per_1k'] * chars / 1000)
    return text


def draw_image(prompt):
    if not cfg('ARK_API_KEY'):
        raise ApiError('服务器没配画师 Key', 503)
    if NO_AI:
        raise ApiError('这台服务器用 --no-ai 启动,不代理 AI 生成', 503)
    if LIMIT_IMG_PER_DAY and images_today() >= LIMIT_IMG_PER_DAY:
        raise ApiError('今天服务器出图额度用完了(%d 张/天),明天再来或让老师调高上限' % LIMIT_IMG_PER_DAY, 429)
    require_net(ARK_HOST, '火山方舟(出图服务)')
    body = {
        'model': cfg('ARK_MODEL', 'doubao-seedream-5-0-260128'),
        'prompt': str(prompt or '')[:800],
        'size': cfg('ARK_SIZE', '2560x1440'),
        'response_format': 'b64_json', 'watermark': True,
        'negative_prompt': '文字,字母,数字,招牌,标语,商标,水印',
    }
    url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
    err, j = None, None
    for size in [body['size'], '2K']:            # 尺寸兜底:被拒就换 2K 重试
        body['size'] = size
        try:
            j = _post(url, body, {'Authorization': 'Bearer ' + cfg('ARK_API_KEY')})
            break
        except ApiError as e:
            err = e
            if not re.search(r'size|pixel|resolution|InvalidParameter', str(e)):
                raise
    if not j:
        raise ApiError(str(err or '出图失败'))
    data = j.get('data') or []
    first = (data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else {})) or {}
    src = first.get('url') or first.get('image_url') or ''
    b64 = first.get('b64_json')
    if not src and b64:
        mime = 'image/png' if str(b64).startswith('iVBOR') else 'image/jpeg'
        src = 'data:%s;base64,%s' % (mime, b64)
    if not src:
        raise ApiError('上游没返回图片')
    log_usage('image', body['model'], cost=PRICE['image'])
    return src


VIDEO_DURATIONS = (5, 10)
VIDEO_RESOLUTIONS = ('480p', '720p', '1080p')
VIDEO_RATIOS = ('16:9', '9:16', '1:1', '4:3', '3:4', '21:9')
DOWNLOAD_HOST_SUFFIX = ('volces.com', 'bigmodel.cn', 'byteimg.com', 'bytecdn.cn')
MAX_DOWNLOAD_BYTES = 300 * 1024 * 1024      # 单个上游影片最多下这么多,防止把磁盘写满


def clamp_duration(value):
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = VIDEO_DURATIONS[0]
    return n if n in VIDEO_DURATIONS else min(VIDEO_DURATIONS, key=lambda d: abs(d - n))


def pick_option(value, allowed, default):
    v = str(value or '').strip()
    return v if v in allowed else default


def submit_video(prompt, image=None, duration=5, resolution='720p', ratio='16:9'):
    """提交图生视频任务:剧本当提示词 + 首帧画面"""
    key = cfg('VIDEO_API_KEY') or cfg('ARK_API_KEY')
    if not key:
        raise ApiError('服务器没配视频 Key', 503)
    if NO_AI:
        raise ApiError('这台服务器用 --no-ai 启动,不代理 AI 生成', 503)
    require_net(ARK_HOST, '火山方舟(影片服务)')
    duration = clamp_duration(duration)
    resolution = pick_option(resolution, VIDEO_RESOLUTIONS, '720p')
    ratio = pick_option(ratio, VIDEO_RATIOS, '16:9')
    usage_id = reserve_video_slot()
    text = str(prompt or '')[:600].strip() + ' --resolution %s --ratio %s --duration %d' % (resolution, ratio, duration)
    content = [{'type': 'text', 'text': text}]
    if image:
        content.append({'type': 'image_url', 'image_url': {'url': image}})
    url = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'
    first = cfg('VIDEO_MODEL', '')
    order = ([first] if first else []) + VIDEO_MODELS_PREF
    tried = []
    try:
        for m in order:
            if not m or m in tried:
                continue
            tried.append(m)
            try:
                j = _post(url, {'model': m, 'content': content}, {'Authorization': 'Bearer ' + key}, timeout=180)
            except ApiError as e:
                if re.search(r'ModelNotOpen|NotFound|not activated|does not exist|InvalidEndpoint', str(e)):
                    continue                              # 这个模型没开通 → 换下一个
                raise
            tid = j.get('id')
            if not tid:
                raise ApiError('上游没返回任务号:' + str(j)[:150])
            settle_video_slot(usage_id, m, tid)           # 提交成功才占用额度,失败会还回去
            if len(tried) > 1:
                log('  (自动跳过未开通的视频模型:%s)' % '、'.join(tried[:-1]))
            return tid, m
    except BaseException:
        release_video_slot(usage_id)
        raise
    release_video_slot(usage_id)
    raise ApiError('火山账号还没开通任何视频模型:请到火山方舟控制台 →「开通管理」开通 Seedance', 503)


def poll_video(tid):
    j = _get('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/' + tid,
             {'Authorization': 'Bearer ' + (cfg('VIDEO_API_KEY') or cfg('ARK_API_KEY'))})
    status = j.get('status')
    out = {'status': status, 'videoUrl': ((j.get('content') or {}).get('video_url') or ''),
           'model': j.get('model') or '', 'error': j.get('error') or ''}
    if status == 'succeeded':
        tokens = (j.get('usage') or {}).get('completion_tokens') or (j.get('usage') or {}).get('total_tokens') or 0
        out['cost'] = record_video_cost(tid, tokens, out['model'])
    return out


def find_ffmpeg():
    return shutil.which('ffmpeg') or shutil.which('ffmpeg.exe')


def find_ffprobe():
    ff = find_ffmpeg()
    if ff:
        beside = os.path.join(os.path.dirname(ff), 'ffprobe.exe' if os.name == 'nt' else 'ffprobe')
        if os.path.exists(beside):
            return beside
    return shutil.which('ffprobe') or shutil.which('ffprobe.exe')


def media_seconds(path):
    """量一段音视频有多长;没有 ffprobe 就返回 0,调用方退回估算"""
    fp = find_ffprobe()
    if not fp or not os.path.exists(path):
        return 0.0
    try:
        r = subprocess.run([fp, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                           capture_output=True, timeout=60)
        return float((r.stdout or b'').decode('utf-8', 'replace').strip() or 0)
    except (OSError, subprocess.SubprocessError, ValueError):
        return 0.0


def estimate_speech_seconds(text):
    """没有 ffprobe 时的兜底:中文朗读大约每秒 4.5 个字"""
    return len(re.sub(r'\s+', '', str(text or ''))) / 4.5


def segment_seconds(narration_seconds, minimum=5.0, tail=0.4):
    """一段镜头多长:旁白更长就以旁白为准,免得这句话被切断"""
    try:
        said = float(narration_seconds or 0)
    except (TypeError, ValueError):
        said = 0.0
    if said != said or said < 0:          # NaN / 负数
        said = 0.0
    return round(max(float(minimum), said + float(tail)), 2)


def _film_vf(width=FILM_W, height=FILM_H, fps=FILM_FPS):
    return ('scale=%d:%d:force_original_aspect_ratio=decrease,'
            'pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=%d') % (width, height, width, height, fps)


def _film_encode():
    """所有段统一编码,后面才能用 -c copy 直接拼"""
    return ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2']


def segment_cmd(ff, src, wav, out, seconds):
    """一段镜头:画面循环到 seconds 秒 + 这句旁白(旁白短就补静音,长短都不跑偏)"""
    return [ff, '-y', '-stream_loop', '-1', '-i', src, '-i', wav,
            '-map', '0:v:0', '-map', '1:a:0', '-af', 'apad',
            '-t', '%.2f' % float(seconds), '-vf', _film_vf()] + _film_encode() + [out]


def still_cmd(ff, img, wav, out, seconds):
    """这一段没生成出镜头时的降级:用这一格的分镜图当静帧,照样配上这句旁白"""
    return [ff, '-y', '-loop', '1', '-framerate', str(FILM_FPS), '-i', img, '-i', wav,
            '-map', '0:v:0', '-map', '1:a:0', '-af', 'apad',
            '-t', '%.2f' % float(seconds), '-vf', _film_vf()] + _film_encode() + [out]


def stitch_cmd(ff, listfile, out):
    """把已经编码一致的 N 段直接串起来(不重新编码,快)"""
    return [ff, '-y', '-f', 'concat', '-safe', '0', '-i', listfile, '-c', 'copy',
            '-movflags', '+faststart', out]


# ------------------------------------------------ 字幕
SUBTITLE_FONTS = [
    'C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/Deng.ttf', 'C:/Windows/Fonts/simsun.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
]
SUBTITLE_LINE_CHARS = 30          # 一行最多多少字(1280 宽、36 号字大概装得下这么多)
SUBTITLE_PUNCT = '，。！？；、：,.!?;:'


def find_cjk_font():
    """找一个能显示中文的字体;烧字幕必须显式指定字体文件,否则可能出现方框"""
    for p in SUBTITLE_FONTS:
        if os.path.exists(p):
            return p
    return ''


def wrap_subtitle(text, width=SUBTITLE_LINE_CHARS):
    """把一句旁白折行:两句以内尽量对半劈在最靠近中间的标点上(不会把词切开),
       更长的就先在标点处断、没标点也硬断;最多三行,一个字都不丢,也不许顶出画面。"""
    s = re.sub(r'\s+', '', str(text or '')).strip()
    if not s:
        return ''
    hard = width + 4                     # 允许的最大行宽(再宽就要出画了)
    if len(s) <= width:
        return s
    if len(s) <= width * 2:              # 两行就够:优先劈在中间的标点上,且两行都别超宽
        mid = len(s) / 2.0
        cuts = [i + 1 for i, ch in enumerate(s)
                if ch in SUBTITLE_PUNCT and max(width // 2, len(s) - width) <= i + 1 <= min(width, len(s) - 4)]
        if cuts:
            cut = min(cuts, key=lambda c: abs(c - mid))
            return s[:cut] + '\n' + s[cut:]
    lines, cur = [], ''
    for ch in s:
        cur += ch
        if len(cur) >= width and ch in SUBTITLE_PUNCT:
            lines.append(cur)
            cur = ''
        elif len(cur) >= hard:           # 一路没有标点也要断,不然会顶出画面
            lines.append(cur)
            cur = ''
    if cur:
        if lines and len(cur) <= max(2, width // 3) and len(lines[-1]) + len(cur) <= width:
            lines[-1] += cur             # 尾巴太短就并进上一行,但别把行撑宽
        else:
            lines.append(cur)
    flat = []                            # 兜底:任何一行超宽都硬切,绝不让字跑出画面
    for row in lines:
        while len(row) > hard:
            flat.append(row[:hard])
            row = row[hard:]
        if row:
            flat.append(row)
    if len(flat) > 3:                    # 超过三行:后半段并进第三行,不能把话吞掉
        flat = flat[:2] + [''.join(flat[2:])]
    return '\n'.join(flat)


def subtitle_cues(spans, pad_start=0.15, pad_end=0.15, shortest=0.8):
    """[(开始, 结束, 旁白)] → 字幕条目。太短的丢掉,两边各留一点空隙"""
    cues = []
    for span in spans or []:
        try:
            a, b, text = float(span[0]), float(span[1]), str(span[2] or '')
        except (IndexError, TypeError, ValueError):
            continue
        if b - a < shortest or not text.strip():
            continue
        cues.append({'start': round(a + pad_start, 2), 'end': round(b - pad_end, 2), 'text': wrap_subtitle(text)})
    return cues


def _drawtext_filter(name, cue, size=36, margin=46):
    """一条字幕的 drawtext 参数:textfile 读文本,避免中文标点在滤镜串里被当语法"""
    return ("drawtext=fontfile=subfont.ttf:expansion=none:textfile=%s:fontsize=%d:"
            "fontcolor=white:borderw=3:bordercolor=black@0.9:"
            "box=1:boxcolor=black@0.32:boxborderw=10:line_spacing=6:"
            "x=(w-text_w)/2:y=h-text_h-%d:enable='between(t,%.2f,%.2f)'"
            % (name, size, margin, float(cue['start']), float(cue['end'])))


def burn_subtitles(video_path, cues, out_path, font=None, size=36, crf=20):
    """把旁白字幕烧进画面(底部居中、半透明底),音轨原样保留"""
    ff = find_ffmpeg()
    if not ff:
        raise ApiError('服务器上没找到 ffmpeg,烧不了字幕', 503)
    if not cues:
        raise ApiError('没有字幕内容', 400)
    font = font or find_cjk_font()
    if not font:
        raise ApiError('没找到中文字体,烧不了字幕(可把字体路径传给 font 参数)', 503)
    work = tempfile.mkdtemp(prefix='bh-sub-')
    try:
        shutil.copyfile(font, os.path.join(work, 'subfont.ttf'))
        parts = []
        for i, cue in enumerate(cues):
            name = 'sub%d.txt' % i
            with open(os.path.join(work, name), 'w', encoding='utf-8') as f:
                f.write(str(cue['text']))
            parts.append(_drawtext_filter(name, cue, size))
        out_name = 'out.mp4'
        cmd = [ff, '-y', '-i', os.path.abspath(video_path), '-vf', ','.join(parts),
               '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-pix_fmt', 'yuv420p',
               '-c:a', 'copy', '-movflags', '+faststart', out_name]
        r = subprocess.run(cmd, cwd=work, capture_output=True, timeout=1800)
        if r.returncode != 0 or not os.path.exists(os.path.join(work, out_name)):
            raise ApiError('烧字幕失败:' + safe_msg(r.stderr.decode('utf-8', 'replace')[-200:]))
        shutil.move(os.path.join(work, out_name), out_path)
        return out_path
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _write_data_url(data, directory, stem):
    """把前端的 data:image/... 内嵌图片落到磁盘(降级静帧用),按 mime 定扩展名,返回落盘路径"""
    m = re.match(r'^data:([\w/+.-]+);base64,(.+)$', str(data or ''), re.S)
    if not m:
        raise ApiError('内嵌图片格式不对', 400)
    mime = m.group(1).lower()
    ext = '.png' if 'png' in mime else '.webp' if 'webp' in mime else '.jpg'
    path = os.path.join(directory, stem + ext)
    try:
        raw = base64.b64decode(m.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise ApiError('内嵌图片的 base64 坏了', 400)
    with open(path, 'wb') as f:
        f.write(raw)
    return path


def stitch_film(segments, title='', voice=None):
    """每格一段镜头 + 每格一句旁白 → 按剧本顺序拼成一部片子。

    segments: [{'videoUrl': '...', 'line': '这一格的剧本句'}, ...]
              某一段没有 videoUrl 时,可以带上 'image'(data URL)降到静帧。
    """
    ff = find_ffmpeg()
    if not ff:
        raise ApiError('服务器上没找到 ffmpeg,装上就能把各段镜头拼成一部片子', 503)
    items, skipped = [], []
    for i, s in enumerate(segments or []):
        if not isinstance(s, dict):
            skipped.append(i)
            continue
        url, img = str(s.get('videoUrl') or '').strip(), str(s.get('image') or '').strip()
        if url or img:
            items.append({'url': url, 'image': img, 'line': str(s.get('line') or '').strip()})
        else:
            skipped.append(i)                 # 既没镜头也没图:老实告诉前端少了几格,别悄悄跳过
    items = items[:MAX_FILM_SEGMENTS]
    if not items:
        raise ApiError('没有可拼接的镜头', 400)
    total_chars = sum(len(it['line'] or '第%d格' % (i + 1)) for i, it in enumerate(items))
    if total_chars > LIMIT_TTS_CHARS:
        raise ApiError('整片旁白太长(%d 字,上限 %d 字),把剧本句子缩短一点再来' % (total_chars, LIMIT_TTS_CHARS), 400)
    os.makedirs(FILM_DIR, exist_ok=True)
    fid = 'film-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + str(int(time.time() * 1000) % 1000)
    work = os.path.join(FILM_DIR, fid + '.d')
    os.makedirs(work, exist_ok=True)
    out = os.path.join(FILM_DIR, fid + '.mp4')
    parts, voices = [], 0
    try:
        for i, it in enumerate(items):
            if it['url']:
                src = os.path.join(work, 'v%d.src' % i)
                _download(it['url'], src)
            else:
                src = _write_data_url(it['image'], work, 'v%d' % i)
            text = it['line'] or ('第%d格' % (i + 1))
            wav = os.path.join(work, 'a%d.wav' % i)
            raw, _ct = tts(text, voice)
            with open(wav, 'wb') as f:
                f.write(raw)
            voices += len(text)
            said = media_seconds(wav) or estimate_speech_seconds(text)
            dur = segment_seconds(said)
            seg = os.path.join(work, 'seg%d.mp4' % i)
            cmd = (segment_cmd if it['url'] else still_cmd)(ff, src, wav, seg, dur)
            r = subprocess.run(cmd, capture_output=True, timeout=600)
            if r.returncode != 0 or not os.path.exists(seg):
                raise ApiError('第%d段合成失败:%s' % (i + 1, safe_msg(r.stderr.decode('utf-8', 'replace')[-160:])))
            parts.append(seg)
        listfile = os.path.join(work, 'list.txt')
        with open(listfile, 'w', encoding='utf-8') as f:
            for p in parts:
                f.write("file '%s'\n" % p.replace('\\', '/'))
        r = subprocess.run(stitch_cmd(ff, listfile, out), capture_output=True, timeout=600)
        if r.returncode != 0 or not os.path.exists(out):
            raise ApiError('拼接失败:' + safe_msg(r.stderr.decode('utf-8', 'replace')[-160:]))
        return {'id': fid, 'url': '/api/films/' + fid + '.mp4', 'bytes': os.path.getsize(out),
                'segments': len(parts), 'seconds': round(media_seconds(out), 2),
                'voiceChars': voices, 'title': str(title or '')[:60], 'skipped': skipped}
    except BaseException:
        # 失败时别把半截成片留在片库里
        try:
            if os.path.exists(out):
                os.remove(out)
        except OSError:
            pass
        raise
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _download(url, path, timeout=240, max_bytes=MAX_DOWNLOAD_BYTES):
    """把上游的视频下载到本机(顺便避开浏览器跨域限制)。
       只允许白名单域名,并按字节上限截断:不然任何请求都能让服务器去抓任意地址。"""
    host = (urlparse(str(url or '')).hostname or '').lower()
    if not host:
        raise ApiError('视频地址不对', 400)
    if not any(host == s or host.endswith('.' + s) for s in DOWNLOAD_HOST_SUFFIX):
        raise ApiError('只允许从火山/智谱的地址取素材,这个地址(%s)不在白名单' % host, 400)
    req = urllib.request.Request(url, headers={'User-Agent': 'BHFilm/' + APP_VERSION})
    written = 0
    with opener_for(host).open(req, timeout=timeout) as r, open(path, 'wb') as f:
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            written += len(chunk)
            if written > max_bytes:
                raise ApiError('上游文件太大(超过 %d MB),已中止' % (max_bytes // 1024 // 1024))
            f.write(chunk)
    return written


def mux_film(video_url, lines, voice=None, title=''):
    """Seedance 的无声视频 + GLM-TTS 旁白 → 一条带配音的 mp4
       (片子比旁白短就循环播放画面,直到旁白说完)"""
    ff = find_ffmpeg()
    if not ff:
        raise ApiError('服务器上没找到 ffmpeg,装上就能自动合成配音(也可以先用「本机录制」)', 503)
    if not video_url:
        raise ApiError('缺少视频地址')
    text = '。'.join(str(x).strip() for x in (lines or []) if str(x).strip())[:LIMIT_TTS_CHARS]
    if not text:
        text = str(title or '我的电影')
    os.makedirs(FILM_DIR, exist_ok=True)
    fid = 'film-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + str(int(time.time() * 1000) % 1000)
    vpath = os.path.join(FILM_DIR, fid + '.src')
    apath = os.path.join(FILM_DIR, fid + '.wav')
    out = os.path.join(FILM_DIR, fid + '.mp4')
    try:
        _download(video_url, vpath)
        raw, _ct = tts(text, voice)                     # GLM-TTS 旁白
        with open(apath, 'wb') as f:
            f.write(raw)
        cmd = [ff, '-y', '-stream_loop', '-1', '-i', vpath, '-i', apath,
               '-map', '0:v:0', '-map', '1:a:0',
               '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '24',
               '-c:a', 'aac', '-b:a', '128k', '-shortest', out]
        r = subprocess.run(cmd, capture_output=True, timeout=600)
        if r.returncode != 0 or not os.path.exists(out):
            raise ApiError('配音合成失败:' + safe_msg(r.stderr.decode('utf-8', 'replace')[-160:]))
        return {'id': fid, 'url': '/api/films/' + fid + '.mp4',
                'bytes': os.path.getsize(out), 'voiceChars': len(text)}
    finally:
        for f in (vpath, apath):
            try:
                if os.path.exists(f):
                    os.remove(f)
            except OSError:
                pass


def tts(text, voice=None, speed=None):
    key = cfg('VOICE_API_KEY') or cfg('ZHIPU_API_KEY')
    if not key:
        raise ApiError('服务器没配配音 Key', 503)
    if NO_AI:
        raise ApiError('这台服务器用 --no-ai 启动,不代理 AI 生成', 503)
    try:
        rate = float(speed or cfg('VOICE_SPEED', '1.0') or 1.0)
    except (TypeError, ValueError):
        rate = 1.0                     # .env 里 VOICE_SPEED 填错不该让整个配音挂掉
        log('⚠️ VOICE_SPEED 不是数字,已按 1.0 处理')
    payload = {'model': cfg('VOICE_MODEL', 'glm-tts'), 'input': str(text or '')[:LIMIT_TTS_CHARS],
               'voice': voice or cfg('VOICE_VOICE', 'female'),
               'speed': min(2.0, max(0.5, rate)),
               'response_format': 'wav'}          # 实测只支持 wav / pcm
    raw, ctype = _post('https://open.bigmodel.cn/api/paas/v4/audio/speech', payload,
                       {'Authorization': 'Bearer ' + key}, raw=True)
    log_usage('tts', payload['model'], chars=len(payload['input']), cost=PRICE['tts_per_1k'] * len(payload['input']) / 1000)
    return raw, (ctype or 'audio/wav')


# ------------------------------------------------ 静态文件
MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
}
BLOCKED = {'.env', 'bh.db', 'server.log', 'package-lock.json'}


def resolve_static(url_path):
    rel = unquote(urlparse(url_path).path).lstrip('/').replace('\\', '/')
    if rel in ('', '/'):
        rel = 'index.html'
    full = os.path.normpath(os.path.join(HERE, rel))
    # 前缀比较必须带路径分隔符,否则"脑洞放映厅备份"这种同名前缀的兄弟目录能被读到
    if full != HERE and not full.startswith(HERE + os.sep):
        return None
    base = os.path.basename(full)
    if base in BLOCKED or base.startswith('.'):
        return None
    # data/ 里是作品库、影片和数据库:一律不走静态直读(影片要用 /api/films 的 Range 路由)
    try:
        if os.path.commonpath([os.path.abspath(full), os.path.abspath(DATA_DIR)]) == os.path.abspath(DATA_DIR):
            return None
    except ValueError:
        return None
    if os.path.isdir(full):
        full = os.path.join(full, 'index.html')
    return full if os.path.isfile(full) else None


def parse_range(header, size):
    """解析 Range 头 → (start, end, partial)。
       返回 (None, None, False) 表示这个范围不合法(调用方要回 416)。
       不合法或没带 Range 时按整段返回,别让 Content-Length 变成负数。"""
    rng = str(header or '').strip()
    if not rng:
        return 0, size - 1, False
    m = re.match(r'^bytes=\s*(\d*)\s*-\s*(\d*)\s*$', rng)
    if not m or (not m.group(1) and not m.group(2)):
        return 0, size - 1, False          # 看不懂就当整段,别回 206 骗客户端
    if not m.group(1):                      # bytes=-N:最后 N 字节
        last = int(m.group(2))
        if last <= 0:
            return None, None, False
        return max(0, size - last), size - 1, True
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else size - 1
    end = min(end, size - 1)
    if start >= size or start > end:
        return None, None, False
    return start, end, True


# ------------------------------------------------ HTTP
_RATE = {}
_RATE_LOCK = threading.Lock()
API_METHODS = {           # 每个接口允许的方法;不在表里的路径默认只读
    '/api/story': {'POST'}, '/api/synopsis': {'POST'}, '/api/polish': {'POST'},
    '/api/image': {'POST'}, '/api/tts': {'POST'}, '/api/video': {'POST'},
    '/api/video/': {'GET'}, '/api/film': {'POST'}, '/api/film/stitch': {'POST'},
    '/api/works': {'GET', 'POST'}, '/api/works/': {'GET', 'DELETE'},
    '/api/health': {'GET'}, '/api/config': {'GET'}, '/api/films/': {'GET'},
}


WORK_ID_RE = re.compile(r'^[\w\-]+$')
WORK_ID_PATH_RE = re.compile(r'^/api/works/([\w\-]+)$')


def parse_limit(raw, default=100, cap=1000):
    """查表用的 limit:非法值不当成 500,负数也不能绕过上限"""
    try:
        n = int(str(raw).strip())
    except (TypeError, ValueError):
        return default
    return max(1, min(n, cap))


def allowed_methods(path):
    """按路径查允许的方法。付费/写接口只有 POST,防止 <img src> 之类的盲打死接口烧钱。"""
    if path in API_METHODS:
        return API_METHODS[path]
    for prefix in ('/api/video/', '/api/works/', '/api/films/'):
        if path.startswith(prefix):
            return API_METHODS[prefix]
    return {'GET'}


def rate_ok(ip):
    """只给 /api/* 计数:静态资源(index.html、js、css、图)被打满就整个应用打不开了"""
    now = time.time()
    with _RATE_LOCK:
        hits = [t for t in _RATE.get(ip, []) if now - t < 60]
        if not hits and ip in _RATE:
            _RATE.pop(ip, None)                  # 顺手清掉不再活跃的 IP,别让字典一直长
        hits.append(now)
        _RATE[ip] = hits
        return len(hits) <= LIMIT_REQ_PER_MIN


class Handler(BaseHTTPRequestHandler):
    server_version = 'BHFilm/' + APP_VERSION
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Access-Control-Max-Age', '86400')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def handle(self):
        """客户端提前断开(关页面、拖进度条、浏览器预连接)时安静关掉这条连接,
           不要让 socketserver 把整段 traceback 打进日志 —— 那不是服务器的错。"""
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, TimeoutError):
            self.close_connection = True

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, TimeoutError)):
            self.close_connection = True
            return
        super().handle_error(request, client_address)

    def _send(self, code, body=b'', ctype='application/json; charset=utf-8'):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False))

    def _err(self, code, msg):
        self._json(code, {'ok': False, 'error': msg})

    def _drop_body(self):
        """出错提前返回时,把请求体读掉再关连接:
           否则残留字节会被当成下一个请求行(keep-alive 连接被污染,后续请求随机 400/501)"""
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            n = 0
        if n > 0:
            try:
                self.rfile.read(min(n, MAX_WORK_BYTES + 1))
            except (OSError, ValueError):
                pass
        self.close_connection = True

    def _body(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            n = 0
        if n <= 0:
            return {}
        if n > MAX_WORK_BYTES:
            self._drop_body()
            self._err(413, '请求体太大(>25MB)')
            return None
        try:
            data = json.loads(self.rfile.read(n).decode('utf-8'))
        except ValueError:
            self._err(400, '请求体不是合法 JSON')
            return None
        if not isinstance(data, dict):
            self._err(400, '请求体必须是 JSON 对象')
            return None
        return data

    def log_message(self, fmt, *args):
        if os.environ.get('BH_VERBOSE'):
            log('HTTP', fmt % args)

    def do_GET(self):
        self.route('GET')

    def do_HEAD(self):
        self.route('GET')

    def do_POST(self):
        self.route('POST')

    def do_DELETE(self):
        self.route('DELETE')

    def do_PUT(self):
        self._drop_body()
        self._err(405, '不支持 PUT,只支持 GET/POST/DELETE')

    do_PATCH = do_PUT

    def route(self, method):
        path = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query)
        try:
            if path.startswith('/api/'):
                if not rate_ok(self.client_address[0]):
                    self._drop_body()
                    return self._err(429, '请求太频繁了,歇一秒再试')
                if method not in allowed_methods(path):
                    self._drop_body()
                    return self._err(405, '这个接口不支持 ' + method + ',请用 ' + '/'.join(sorted(allowed_methods(path))))
                return self.api(method, path, qs)
            if method != 'GET':
                self._drop_body()
                return self._err(405, '只支持 GET')
            full = resolve_static(path)
            if not full:
                return self._send(404, '<h1>404</h1><p>没有这个文件</p>', MIME['.html'])
            ext = os.path.splitext(full)[1].lower()
            with open(full, 'rb') as f:
                self._send(200, f.read(), MIME.get(ext) or mimetypes.guess_type(full)[0] or 'application/octet-stream')
        except ApiError as e:
            mod = ('story' if path in ('/api/story', '/api/polish', '/api/synopsis') else
                   'image' if path == '/api/image' else
                   'video' if path.startswith('/api/video') or path.startswith('/api/film') else
                   'tts' if path == '/api/tts' else 'other')
            log('❌ %s 失败:%s' % (mod, safe_msg(str(e))))
            log_usage(mod, '-', ok=0, err=str(e))
            self._err(e.status, safe_msg(str(e)))
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True          # 用户关页面/拖进度条:别当服务器错误去刷日志
        except Exception as e:
            log('❌ 未处理异常', traceback.format_exc(limit=3))
            self._err(500, '服务器内部错误:' + safe_msg(str(e))[:150])

    def api(self, method, path, qs):
        body = self._body() if method in ('POST', 'DELETE') else {}
        if body is None:
            return

        if path == '/api/health':
            with db() as conn:
                n = conn.execute('SELECT COUNT(*) c FROM works').fetchone()['c']
            return self._json(200, {'ok': True, 'version': APP_VERSION, 'uptime': int(time.time() - START_TS), 'works': n})

        if path == '/api/config':
            return self._json(200, {
                'ok': True, 'backend': True, 'version': APP_VERSION, 'ai': not NO_AI,
                'modules': modules(),          # ready / reach / net / model 都给前端
                'netwhy': {k: v for k, v in _NET_WHY.items() if v},
                'limits': {'images': LIMIT_IMG_PER_WORK, 'voiceChars': LIMIT_TTS_CHARS,
                           'videosPerDay': video_day_limit(), 'videoUnlimited': video_day_limit() == 0,
                           'videosToday': videos_today(), 'maxFilmSegments': MAX_FILM_SEGMENTS},
            })

        if path == '/api/story':
            """把抽到的卡 + 孩子补充的细节 → 交给 GLM-5.2 写成剧本(一行一页)"""
            cards = body.get('cards') or []
            idea = str(body.get('idea') or '')[:800]
            old = str(body.get('old') or '')[:800]
            cardText = '、'.join('%s:%s' % (c.get('slot', ''), c.get('card', '')) for c in cards if c.get('card'))
            sys = ('你是儿童动画的编剧,服务对象是小学生。把孩子的素材写成分镜剧本:\n'
                   '① 每行一幕,一行就是一页分镜,共 3~6 行;每行 15~40 字,写清"谁在哪里做什么";\n'
                   '② 孩子给的角色、场景、事件、补充细节必须全部用上,不要改掉,也不要新增设定;\n'
                   '③ 用孩子的语气,不要出现"导演说""第一幕"这类旁白,不要台词引号;\n'
                   '④ 结局留一点想象空间。只输出剧本正文,不要标题、不要解释、不要编号。')
            user = '【抽到的卡】' + (cardText or '(无)') + '\n【孩子的补充】' + (idea or '(无)')
            if old:
                user += '\n【上一版剧本(请换一种写法,但事实不变)】\n' + old
            text = zhipu_chat([{'role': 'system', 'content': sys}, {'role': 'user', 'content': user}], 700, 0.9, 'story')
            lines = [l.strip(' 0123456789.、-—') for l in text.split('\n') if l.strip()][:6]
            return self._json(200, {'ok': True, 'lines': lines or [text]})

        if path == '/api/synopsis':
            """把抽到的卡 + 孩子的补充 → 一段通顺的故事简介(GLM-5.2)"""
            cards = body.get('cards') or []
            idea = str(body.get('idea') or '')[:800]
            cardText = '、'.join('%s:%s' % (c.get('slot', ''), c.get('card', '')) for c in cards if c.get('card'))
            sys = ('你是给小学生讲故事的编辑。把孩子抽到的脑洞卡和补充的细节,写成一段通顺、有画面感的故事简介:\n'
                   '① 2~3 句,60~120 字,像故事的开头那样一口气读下来;\n'
                   '② 说清楚:谁、在哪里、想做什么、碰上什么麻烦;只写孩子给的素材,不要新增设定、不要改角色;\n'
                   '③ 不要分点、不要标题、不要引号、不要"简介""故事"这种词;\n'
                   '④ 句子之间要用"可是""于是""没想到"这类词连起来,读着顺。只输出这一段话。')
            user = '【抽到的卡】' + (cardText or '(还没抽卡)') + '\n【孩子补充的细节】' + (idea or '(还没补充)')
            text = zhipu_chat([{'role': 'system', 'content': sys}, {'role': 'user', 'content': user}], 300, 0.8, 'synopsis')
            return self._json(200, {'ok': True, 'synopsis': text.strip().strip('"“”')})

        if path == '/api/polish':
            """把孩子的画面提示词润色得更具体(不改变他的想法)"""
            cap = str(body.get('cap') or '')[:200]
            prm = str(body.get('prompt') or '')[:400]
            style = str(body.get('style') or '')[:40]
            sys = ('你是儿童动画的分镜师。把孩子写的画面提示词整理得更具体、更适合文生图:\n'
                   '① 保留孩子原本的想法和角色,不要换主角、不要加新角色;② 写清"谁·在哪里·在做什么·什么氛围";\n'
                   '③ 加上画风"' + (style or '儿童绘本插画') + '"和"整张图不出现任何文字";④ 40~80 字,只输出提示词本身。')
            user = '这一页的台词:' + (cap or '(无)') + '\n孩子写的提示词:' + (prm or '(还没写)')
            return self._json(200, {'ok': True, 'prompt': zhipu_chat([{'role': 'system', 'content': sys}, {'role': 'user', 'content': user}], 300, 0.7, 'polish')})

        if path == '/api/image':
            return self._json(200, {'ok': True, 'src': draw_image(body.get('prompt'))})

        if path == '/api/film':
            r = mux_film(body.get('videoUrl'), body.get('lines') or [], body.get('voice'), body.get('title'))
            log('🎞️ 合成带配音的影片:%s(%d KB)' % (r['id'], r['bytes'] // 1024))
            return self._json(200, dict({'ok': True}, **r))

        if path == '/api/film/stitch':
            """每格一段镜头 → 按剧本顺序拼成一部片子(每段配自己那句旁白)"""
            r = stitch_film(body.get('segments') or [], body.get('title') or '', body.get('voice'))
            log('🎞️ 多镜头拼接完成:%s(%d 段 · %.1f 秒 · %d KB)' % (r['id'], r['segments'], r['seconds'], r['bytes'] // 1024))
            return self._json(200, dict({'ok': True}, **r))

        m = re.match(r'^/api/films/([\w\-]+\.mp4)$', path)
        if m:
            fp = os.path.join(FILM_DIR, m.group(1))
            if not os.path.isfile(fp):
                return self._err(404, '没有这部影片')
            size = os.path.getsize(fp)
            start, end, partial = parse_range(self.headers.get('Range'), size)
            if start is None:
                self.send_response(416)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Range', 'bytes */%d' % size)
                payload = json.dumps({'ok': False, 'error': 'Range 超出范围'}, ensure_ascii=False).encode('utf-8')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                if self.command != 'HEAD':
                    self.wfile.write(payload)
                return
            length = end - start + 1
            self.send_response(206 if partial else 200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Length', str(length))
            if partial:
                self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
            self.end_headers()
            if self.command == 'HEAD':
                return
            try:
                with open(fp, 'rb') as f:
                    f.seek(start)
                    left = length
                    while left > 0:
                        chunk = f.read(min(65536, left))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                self.close_connection = True          # 用户拖进度条/关页面很正常,不该刷栈
            return

        if path == '/api/tts':
            raw, ctype = tts(body.get('text'), body.get('voice'), body.get('speed'))
            return self._send(200, raw, ctype)

        if path == '/api/video':
            tid, model = submit_video(body.get('prompt'), body.get('image'),
                                      int(body.get('duration') or 5), body.get('resolution') or '720p',
                                      body.get('ratio') or '16:9')
            return self._json(200, {'ok': True, 'taskId': tid, 'model': model,
                                    'dayUsed': videos_today(), 'dayLimit': video_day_limit()})

        m = re.match(r'^/api/video/([\w\-]+)$', path)
        if m:
            return self._json(200, dict({'ok': True}, **poll_video(m.group(1))))

        # ---- 作品备份 ----
        if path == '/api/works':
            if method == 'GET':
                limit = parse_limit((qs.get('limit') or ['100'])[0], 100, 1000)
                with db() as conn:
                    rows = [dict(r) for r in conn.execute(
                        'SELECT id,title,director,style,pages,updated_at FROM works ORDER BY updated_at DESC LIMIT ?', (limit,))]
                return self._json(200, {'ok': True, 'works': rows})
            if method == 'POST':
                w = body.get('work') or {}
                if not isinstance(w, dict):
                    return self._err(400, 'work 必须是对象')
                wid = str(w.get('id') or '')
                if not WORK_ID_RE.match(wid):        # 和读取/删除用的正则保持一致,免得存进去再也取不回来
                    return self._err(400, '作品 id 只能用字母、数字、下划线和减号')
                payload = json.dumps(w, ensure_ascii=False)
                if len(payload.encode('utf-8')) > MAX_WORK_BYTES:
                    return self._err(413, '作品太大(>25MB)')
                now = datetime.now().isoformat(timespec='seconds')
                with db() as conn:
                    old = conn.execute('SELECT created_at FROM works WHERE id=?', (wid,)).fetchone()
                    conn.execute('''INSERT INTO works(id,title,director,style,pages,created_at,updated_at,payload)
                                    VALUES(?,?,?,?,?,?,?,?)
                                    ON CONFLICT(id) DO UPDATE SET
                                      title=excluded.title, director=excluded.director, style=excluded.style,
                                      pages=excluded.pages, updated_at=excluded.updated_at, payload=excluded.payload''',
                                 (wid, str(w.get('title', ''))[:60], str(w.get('director', ''))[:30],
                                  str(w.get('style', ''))[:30], len(w.get('panels') or []),
                                  old['created_at'] if old else now, now, payload))
                return self._json(200, {'ok': True, 'id': wid})

        m = WORK_ID_PATH_RE.match(path)
        if m:
            wid = m.group(1)
            if method == 'GET':
                with db() as conn:
                    row = conn.execute('SELECT payload FROM works WHERE id=?', (wid,)).fetchone()
                if not row:
                    return self._err(404, '没有这部作品')
                return self._json(200, {'ok': True, 'work': json.loads(row['payload'])})
            if method == 'DELETE':
                with db() as conn:
                    conn.execute('DELETE FROM works WHERE id=?', (wid,))
                return self._json(200, {'ok': True})

        return self._err(404, '没有这个接口:' + path)


def referenced_films():
    """作品库里还被引用着的影片文件名(prune 时不要删)"""
    keep = set()
    try:
        with db() as conn:
            for row in conn.execute('SELECT payload FROM works'):
                text = str(row['payload'] or '')
                for m in re.finditer(r'/api/films/([\w\-.]+\.mp4)', text):
                    keep.add(m.group(1))
    except sqlite3.Error as e:
        log('读取作品引用失败,这次不清理影片:', e)
        return None
    return keep


def prune_films(keep_days=30, keep_count=60):
    """清一清片库:半截的临时目录、太久以前的成片 —— 以前这些从不会回收。
       作品库里还被引用的片子一律不动,否则「重看」会变成死链接。"""
    try:
        if not os.path.isdir(FILM_DIR):
            return 0
        keep = referenced_films()
        if keep is None:
            return 0                     # 读不出引用关系就这次别删,宁可留着也不能删错
        now = time.time()
        films = []
        removed = 0
        for name in os.listdir(FILM_DIR):
            full = os.path.join(FILM_DIR, name)
            try:
                if name.endswith('.d') and os.path.isdir(full):
                    if now - os.path.getmtime(full) > 3600:      # 一小时前的工作目录肯定是残留
                        shutil.rmtree(full, ignore_errors=True)
                    continue
                if not name.endswith('.mp4') or not os.path.isfile(full) or name in keep:
                    continue
                if now - os.path.getmtime(full) > keep_days * 86400:
                    os.remove(full)
                    removed += 1
                    continue
                films.append((os.path.getmtime(full), full))
            except OSError:
                continue
        films.sort(reverse=True)
        for _mtime, path in films[keep_count:]:
            try:
                os.remove(path)
                removed += 1
            except OSError:
                pass
        if removed:
            log('🧹 清理了 %d 个过期影片(保留最近 %d 个 / %d 天)' % (removed, keep_count, keep_days))
        return removed
    except OSError:
        return 0


def main():
    global ENV, NO_AI
    ap = argparse.ArgumentParser(description='脑洞放映厅后端 v4')
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8766)
    ap.add_argument('--lan', action='store_true', help='允许局域网访问(0.0.0.0)')
    ap.add_argument('--no-ai', action='store_true', help='不代理 AI(纯离线课堂)')
    args = ap.parse_args()

    ENV = load_env()
    NO_AI = args.no_ai
    if ENV.get('HTTPS_PROXY') or ENV.get('HTTP_PROXY'):
        global PROXY
        px = (ENV.get('HTTPS_PROXY') or ENV.get('HTTP_PROXY')).strip()
        PROXY = px
        _NET_CACHE.clear()
        threading.Thread(target=proxy_alive, args=(0,), daemon=True).start()
        log('   火山走代理:', proxy_status_label(px), '(代理没开时会自动退回直连,只有火山受影响)')
    # 置好代理之后再预热探测(否则会拿直连的结果缓存住)
    threading.Thread(target=lambda: (net_ok(ZHIPU_HOST), net_ok(ARK_HOST)), daemon=True).start()
    init_db()
    prune_films()
    srv = ThreadingHTTPServer(('0.0.0.0' if args.lan else args.host, args.port), Handler)

    m = modules()
    t = lambda ok: '✅' if ok else '—'
    log('=' * 60)
    log('🎬 脑洞放映厅 后端 v%s' % APP_VERSION)
    log('   游戏地址: http://127.0.0.1:%d/' % args.port)
    log('   写剧本/润色 %s %-30s 配音 %s %s' % (t(m['story']['ready']), m['story']['model'], t(m['tts']['ready']), m['tts']['model']))
    log('   画分镜      %s %-30s 影片 %s %s' % (t(m['image']['ready']), m['image']['model'], t(m['video']['ready']), m['video']['model']))
    if NO_AI:
        log('   (--no-ai:AI 已关闭,剧本走整理模式、画面走程序化插画)')
    log('   数据: %s' % DB_PATH)
    log('=' * 60)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        log('收到 Ctrl+C,服务关闭')
    finally:
        srv.server_close()


if __name__ == '__main__':
    main()
