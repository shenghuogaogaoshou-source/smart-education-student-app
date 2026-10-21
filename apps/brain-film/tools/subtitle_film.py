#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给已经出好的片子烧上旁白字幕。

为什么是命令行而不是网页按钮:首映礼的「逐格拍片」已经在服务端把每格旁白配进去了,
这里的字幕是给**成品片**补烧的(比如片子是先出的、字幕后加的),或者老师批量给学生作品加水印式字幕。

用法:
  # 四句剧本、自动按关键帧找每段的分界
  py -3 tools/subtitle_film.py data/films/film-xxx.mp4 --lines "第一句" "第二句" "第三句" "第四句"

  # 自己指定每段的开始时间(秒),更准
  py -3 tools/subtitle_film.py 影片.mp4 --bounds 0,10.94,22.19,33.11 --lines "第一句" "第二句" "第三句" "第四句"

  # 只想看看会切成什么样,不真的烧
  py -3 tools/subtitle_film.py 影片.mp4 --lines "..." --dry-run

不加 --out 时就地覆盖原文件(会先备份成 <原名>.orig.mp4)。
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402


def detect_bounds(video, count):
    """没有给分界时:用关键帧的间隔找出每段镜头的起点(逐格拍片是各段独立编码后拼的)"""
    ff = server.find_ffmpeg()
    if not ff or count <= 1:
        return None
    r = subprocess.run([ff, '-hide_banner', '-i', video, '-filter:v',
                        "select='gt(scene,0.25)',showinfo", '-f', 'null', '-'], capture_output=True)
    times = sorted({round(float(m), 2) for m in
                    re.findall(r'pts_time:([0-9.]+)', r.stderr.decode('utf-8', 'replace'))})
    if len(times) < count - 1:
        return None
    total = server.media_seconds(video)
    if count == 2:
        return [0.0, times[0]]
    # 取间隔最接近"总长/(段数)"的那几个点
    target = total / count
    picked, last = [0.0], 0.0
    for t in times:
        if t - last >= target * 0.6:
            picked.append(t)
            last = t
        if len(picked) == count:
            break
    return picked[:count] if len(picked) == count else None


def main():
    ap = argparse.ArgumentParser(description='给一部片子烧上旁白字幕')
    ap.add_argument('video', help='要处理的 mp4/webm')
    ap.add_argument('--lines', nargs='+', required=True, help='每段的旁白,一句一段')
    ap.add_argument('--bounds', default='', help='每段开始的秒数,逗号分隔;不给就自动找')
    ap.add_argument('--out', default='', help='输出文件;不给就地覆盖(先备份)')
    ap.add_argument('--size', type=int, default=36, help='字号(默认 36)')
    ap.add_argument('--dry-run', action='store_true', help='只打印切法,不烧')
    args = ap.parse_args()

    if not os.path.isfile(args.video):
        sys.exit('找不到影片:' + args.video)
    total = server.media_seconds(args.video)
    if not total:
        sys.exit('量不出影片时长(ffprobe 是不是没装?)')

    lines = [x.strip() for x in args.lines if x.strip()]
    if args.bounds:
        bounds = [float(x) for x in args.bounds.split(',') if x.strip()]
    else:
        bounds = detect_bounds(args.video, len(lines)) or []
        if not bounds:
            bounds = [round(total * i / len(lines), 2) for i in range(len(lines))]
            print('⚠️ 没找到可靠的分段,先按等分处理;可用 --bounds 指定', file=sys.stderr)
    if len(bounds) != len(lines):
        sys.exit('分界点数量(%d)和旁白句数(%d)对不上' % (len(bounds), len(lines)))

    spans = [(bounds[i], bounds[i + 1] if i + 1 < len(bounds) else total, lines[i])
             for i in range(len(lines))]
    cues = server.subtitle_cues(spans)
    print('影片 %.2f 秒,字幕 %d 条:' % (total, len(cues)))
    for i, c in enumerate(cues):
        print('  %d) %6.2f~%6.2f 秒  %s' % (i + 1, c['start'], c['end'], c['text'].replace('\n', ' / ')))
    if args.dry_run:
        return

    out = args.out or (args.video + '.sub.mp4')
    server.burn_subtitles(args.video, cues, out, size=args.size)
    print('✅ 烧好了:%s(%.2f MB · %.2f 秒)' % (out, os.path.getsize(out) / 1024 / 1024,
                                             server.media_seconds(out)))
    if not args.out:
        backup = args.video + '.orig.mp4'
        if not os.path.exists(backup):
            shutil.copy2(args.video, backup)
            print('   原片已备份为:%s' % backup)
        shutil.move(out, args.video)
        print('   已就地覆盖:%s' % args.video)


if __name__ == '__main__':
    main()
