"""首映礼 · 逐格镜头拼接的测试。
   用法:python -m unittest discover -s tests -p "test_*.py"
   纯逻辑用例不碰网络、不花钱;最后一个用例会真跑本机 ffmpeg(用 testsrc 造 1 秒纯色片段),
   用来确认"每段统一编码 → concat 拼接"这条路真的通。没装 ffmpeg 时自动跳过。"""
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


class SegmentTimingTests(unittest.TestCase):
    def test_short_narration_keeps_the_minimum_clip_length(self):
        self.assertEqual(server.segment_seconds(1.2), 5.0)

    def test_long_narration_wins_so_the_line_is_not_cut(self):
        self.assertEqual(server.segment_seconds(8.0), 8.4)

    def test_broken_duration_falls_back_to_the_minimum(self):
        for bad in (None, '', 'x', -3, float('nan')):
            self.assertEqual(server.segment_seconds(bad), 5.0, 'bad=%r' % (bad,))

    def test_speech_estimate_shrinks_with_shorter_text(self):
        short = server.estimate_speech_seconds('你好')
        long = server.estimate_speech_seconds('你好' * 20)
        self.assertLess(short, long)
        self.assertAlmostEqual(server.estimate_speech_seconds(''), 0.0)


class CommandShapeTests(unittest.TestCase):
    def test_segment_command_loops_video_and_pads_audio_to_fixed_length(self):
        cmd = server.segment_cmd('ffmpeg', 'clip.src', 'line.wav', 'seg.mp4', 7.5)

        self.assertEqual(cmd[:2], ['ffmpeg', '-y'])
        self.assertIn('-stream_loop', cmd, '画面要循环补齐(但只循环这一段)')
        self.assertEqual(cmd[cmd.index('-stream_loop') + 1], '-1')
        self.assertIn('apad', cmd[cmd.index('-af') + 1], '旁白短了要补静音,否则拼接时音画会错位')
        self.assertEqual(cmd[cmd.index('-t') + 1], '7.50')
        vf = cmd[cmd.index('-vf') + 1]
        self.assertIn('scale=1280:720', vf)
        self.assertIn('pad=1280:720', vf)
        self.assertIn('fps=24', vf)
        self.assertIn('libx264', cmd)
        self.assertIn('aac', cmd)

    def test_still_command_uses_the_panel_image_as_a_frozen_shot(self):
        cmd = server.still_cmd('ffmpeg', 'panel.png', 'line.wav', 'seg.mp4', 5.0)

        self.assertEqual(cmd[cmd.index('-loop') + 1], '1')
        self.assertIn('apad', cmd[cmd.index('-af') + 1])

    def test_stitch_command_concat_copies_without_re_encoding(self):
        cmd = server.stitch_cmd('ffmpeg', 'list.txt', 'film.mp4')

        self.assertEqual(cmd[cmd.index('-f') + 1], 'concat')
        self.assertEqual(cmd[cmd.index('-c') + 1], 'copy')
        self.assertIn('film.mp4', cmd)


class FilmAssemblyTests(unittest.TestCase):
    def _run_with_fakes(self, segments, fake_files=None):
        """把下载/TTS/ffmpeg 全换掉,只验组装逻辑(不出网、不花钱)"""
        created = []

        def fake_download(url, path, timeout=240):
            pathlib.Path(path).write_bytes(b'fake-video')
            return len(b'fake-video')

        def fake_tts(text, voice=None, speed=None):
            return b'fake-wav', 'audio/wav'

        def fake_run(cmd, capture_output=True, timeout=600):
            created.append(cmd)
            out = cmd[-1]
            pathlib.Path(out).write_bytes(b'fake-mp4')
            return subprocess.CompletedProcess(cmd, 0, b'', b'')

        with tempfile.TemporaryDirectory() as temp_dir, \
                patch.object(server, 'FILM_DIR', temp_dir), \
                patch.object(server, 'find_ffmpeg', return_value='ffmpeg'), \
                patch.object(server, '_download', side_effect=fake_download), \
                patch.object(server, 'tts', side_effect=fake_tts), \
                patch.object(server, 'media_seconds', return_value=2.0), \
                patch.object(server, 'subprocess') as fake_sub:
            fake_sub.run.side_effect = fake_run
            fake_sub.CompletedProcess = subprocess.CompletedProcess
            result = server.stitch_film(segments)
        return result, created

    def test_every_panel_becomes_its_own_segment_in_script_order(self):
        segments = [{'videoUrl': 'https://example.com/%d.mp4' % i, 'line': '第%d句' % i} for i in range(3)]
        result, created = self._run_with_fakes(segments)

        self.assertEqual(result['segments'], 3)
        self.assertTrue(result['url'].startswith('/api/films/'))
        encodes = [c for c in created if '-stream_loop' in c]
        self.assertEqual(len(encodes), 3, '3 格应该编码 3 段,而不是只拿第一段凑')
        self.assertEqual(len([c for c in created if 'concat' in c]), 1, '最后只拼一次')

    def test_more_than_ten_panels_are_trimmed(self):
        segments = [{'videoUrl': 'https://example.com/%d.mp4' % i, 'line': '句子%d' % i} for i in range(13)]
        result, _ = self._run_with_fakes(segments)

        self.assertEqual(result['segments'], server.MAX_FILM_SEGMENTS)

    def test_segment_without_video_falls_back_to_a_still_frame(self):
        png = 'data:image/png;base64,' + _png_b64()
        segments = [{'videoUrl': '', 'image': png, 'line': '这一格没生成出来'}]
        result, created = self._run_with_fakes(segments)

        self.assertEqual(result['segments'], 1)
        self.assertEqual(len([c for c in created if '-loop' in c]), 1, '降级段应该走静帧命令')

    def test_empty_segments_are_rejected_before_touching_ffmpeg(self):
        with self.assertRaises(server.ApiError):
            server.stitch_film([])
        with self.assertRaises(server.ApiError):
            server.stitch_film([{'videoUrl': '', 'image': '', 'line': 'x'}])

    def test_bad_embedded_image_is_reported_not_crashed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(server.ApiError):
                server._write_data_url('not-a-data-url', temp_dir, 'v0')


class VideoAccountingTests(unittest.TestCase):
    """并发跑多段视频时,每段的费用必须记回它自己那一行 —— 否则账目会张冠李戴。"""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.patches = [
            patch.object(server, 'DATA_DIR', self.temp.name),
            patch.object(server, 'DB_PATH', str(pathlib.Path(self.temp.name) / 'bh.db')),
            patch.object(server, 'LOG_PATH', str(pathlib.Path(self.temp.name) / 'server.log')),
        ]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)
        server.init_db()

    def _rows(self):
        with server.db() as conn:
            return [dict(r) for r in conn.execute("SELECT ref,chars,cost FROM usage WHERE module='video' ORDER BY id")]

    def test_each_task_gets_its_own_cost_when_they_finish_out_of_order(self):
        for tid in ('task-a', 'task-b', 'task-c'):        # 三段并发提交
            server.log_usage('video', 'doubao-seedance-2-0-mini-260615', ref=tid)
        server.record_video_cost('task-b', 100_000, 'doubao-seedance-2-0-mini-260615')
        server.record_video_cost('task-a', 50_000, 'doubao-seedance-2-0-mini-260615')
        server.record_video_cost('task-c', 200_000, 'doubao-seedance-2-0-mini-260615')

        rows = {r['ref']: r for r in self._rows()}
        self.assertEqual(len(rows), 3, '三段应该各占一行')
        self.assertEqual(rows['task-a']['chars'], 50_000)
        self.assertEqual(rows['task-b']['chars'], 100_000)
        self.assertEqual(rows['task-c']['chars'], 200_000)
        self.assertAlmostEqual(rows['task-c']['cost'], 200_000 / 1_000_000 * 14, places=3)
        self.assertGreater(rows['task-a']['cost'], 0)
        self.assertEqual(sum(r['cost'] for r in rows.values()) > 0, True)

    def test_failed_requests_do_not_consume_the_daily_video_count(self):
        server.log_usage('video', '-', ok=0, err='没有可拼接的镜头')
        self.assertEqual(server.videos_today(), 0, '失败请求不算额度')
        server.log_usage('video', 'doubao-seedance-2-0-mini-260615', ref='task-x')
        self.assertEqual(server.videos_today(), 1)

    def test_daily_limit_can_be_switched_off(self):
        with patch.object(server, 'ENV', {'VIDEO_LIMIT_PER_DAY': '0'}):
            self.assertEqual(server.video_day_limit(), 0)
        with patch.object(server, 'ENV', {'VIDEO_LIMIT_PER_DAY': '5'}):
            self.assertEqual(server.video_day_limit(), 5)
        with patch.object(server, 'ENV', {}):
            self.assertEqual(server.video_day_limit(), server.LIMIT_VIDEO_PER_DAY)
        with patch.object(server, 'ENV', {'VIDEO_LIMIT_PER_DAY': '不是数字'}):
            self.assertEqual(server.video_day_limit(), server.LIMIT_VIDEO_PER_DAY, '填错就退回默认值')


class SubtitleTests(unittest.TestCase):
    def test_short_line_keeps_one_row(self):
        self.assertEqual(server.wrap_subtitle('五个同伴在实验室里'), '五个同伴在实验室里')

    def test_long_line_breaks_at_punctuation(self):
        text = '五个志同道合的同伴在实验室里给和蔼可亲的导师展示项目，桌上摆着一台笔记本和一个显示器。'
        wrapped = server.wrap_subtitle(text, width=20)
        rows = wrapped.split('\n')
        self.assertGreater(len(rows), 1, wrapped)
        self.assertLessEqual(len(rows), 3, '最多三行,再多会挡住画面')
        for r in rows:
            self.assertLessEqual(len(r), 20 + 8, '断行后不该超太多:' + r)

    def test_very_long_text_is_capped_at_three_rows_without_losing_words(self):
        wrapped = server.wrap_subtitle('天' * 400, width=10)
        rows = wrapped.split('\n')
        self.assertEqual(len(rows), 3, '最多三行')
        self.assertEqual(len(wrapped.replace('\n', '')), 400, '一个字都不能丢')

    def test_long_run_without_punctuation_still_breaks(self):
        rows = server.wrap_subtitle('天' * 60, width=26).split('\n')
        self.assertGreater(len(rows), 1, '没有标点也要硬断,否则一行会顶出画面')

    def test_every_row_fits_the_frame_for_real_narration(self):
        lines = [
            '五个志同道合的同伴在实验室里给和蔼可亲的导师展示项目，桌上摆着一台笔记本和一个显示器。',
            '导师凑近看，提出三个不满意的地方，大家赶紧围在笔记本和显示器前一起讨论怎么修改完善。',
            '同伴们越聊越起劲，小手在键盘上飞快敲着，实验室里满是他们热烈讨论修改办法的声音。',
            '夜深了实验室还亮着灯，五个同伴和导师还在对着笔记本和显示器研究，不知道最后能改成什么样。',
        ]
        width = server.SUBTITLE_LINE_CHARS
        for line in lines:
            wrapped = server.wrap_subtitle(line)
            for row in wrapped.split('\n'):
                self.assertLessEqual(len(row), width + 4, '这一行会顶出画面:' + row)
            self.assertEqual(len(wrapped.replace('\n', '')), len(line), '不能少字:' + line)

    def test_two_row_split_prefers_a_punctuation_near_the_middle(self):
        rows = server.wrap_subtitle('同伴们越聊越起劲，小手在键盘上飞快敲着，实验室里满是他们热烈讨论修改办法的声音。').split('\n')
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0].endswith('，'), '两行时优先断在标点后,别把词切成两半:' + rows[0])
        self.assertLessEqual(len(rows[0]), server.SUBTITLE_LINE_CHARS)

    def test_cues_are_trimmed_inward_and_tiny_ones_dropped(self):
        cues = server.subtitle_cues([(0, 10, '第一句'), (10, 10.5, '太短了'), (10, 22, '')])
        self.assertEqual(len(cues), 1)
        self.assertEqual(cues[0]['start'], 0.15)
        self.assertEqual(cues[0]['end'], 9.85)

    def test_filters_are_bottom_centered_and_time_limited(self):
        cues = server.subtitle_cues([(2, 8, '你好')])
        f = server._drawtext_filter('sub0.txt', cues[0])

        self.assertIn('textfile=sub0.txt', f)
        self.assertIn('x=(w-text_w)/2', f, '水平居中')
        self.assertIn('y=h-text_h-', f, '贴底部')
        self.assertIn("enable='between(t,2.15,7.85)'", f, '只在这句旁白期间出现')
        self.assertIn('box=1', f, '带半透明底,浅色画面上也看得清')
        self.assertIn('expansion=none', f, '文本原样显示,不让 % 之类被当变量')

    def test_no_cues_is_a_client_error(self):
        with self.assertRaises(server.ApiError) as ctx:
            server.burn_subtitles('whatever.mp4', [], 'out.mp4')
        self.assertEqual(ctx.exception.status, 400)


def _png_b64():
    import base64
    return base64.b64encode(bytes.fromhex(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000'
        '01f15c4890000000a49444154789c6300010000050001'
        '0d0a2db40000000049454e44ae426082')).decode('ascii')


@unittest.skipUnless(server.find_ffmpeg(), '这台电脑没装 ffmpeg,跳过真拼接用例')
class RealFfmpegTests(unittest.TestCase):
    """真跑一次 ffmpeg:造两段 1 秒纯色片段,按拼接命令串起来,验证总时长和音轨"""

    def test_two_tiny_clips_stitch_into_one_longer_film(self):
        ff = server.find_ffmpeg()
        with tempfile.TemporaryDirectory() as temp_dir:
            work = pathlib.Path(temp_dir)
            parts = []
            for i, color in enumerate(('red', 'blue')):
                src = work / ('clip%d.mp4' % i)
                wav = work / ('a%d.wav' % i)
                seg = work / ('seg%d.mp4' % i)
                subprocess.run([ff, '-y', '-f', 'lavfi', '-i',
                                'color=c=%s:s=320x180:d=1:r=24' % color,
                                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(src)],
                               capture_output=True, check=True)
                subprocess.run([ff, '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
                                '-t', '1', str(wav)], capture_output=True, check=True)
                r = subprocess.run(server.segment_cmd(ff, str(src), str(wav), str(seg), 1.5),
                                   capture_output=True)
                self.assertEqual(r.returncode, 0, r.stderr.decode('utf-8', 'replace')[-300:])
                parts.append(str(seg))
            listfile = work / 'list.txt'
            listfile.write_text(''.join("file '%s'\n" % p.replace('\\', '/') for p in parts), encoding='utf-8')
            out = work / 'film.mp4'
            r = subprocess.run(server.stitch_cmd(ff, str(listfile), str(out)), capture_output=True)
            self.assertEqual(r.returncode, 0, r.stderr.decode('utf-8', 'replace')[-300:])

            seconds = server.media_seconds(str(out)) or server.estimate_speech_seconds('')
            self.assertGreater(seconds, 2.5, '两段 1.5 秒应该拼成 3 秒左右,实际 %.2f' % seconds)
            probe = subprocess.run([server.find_ffprobe() or ff, '-v', 'error', '-show_entries',
                                    'stream=codec_type', '-of', 'csv=p=0', str(out)],
                                   capture_output=True)
            kinds = probe.stdout.decode('utf-8', 'replace')
            self.assertIn('video', kinds)
            self.assertIn('audio', kinds, '成片必须带音轨,否则旁白就丢了')


@unittest.skipUnless(server.find_ffmpeg() and server.find_cjk_font(), '这台电脑没装 ffmpeg 或中文字体,跳过真烧字幕用例')
class RealSubtitleTests(unittest.TestCase):
    """真烧一次字幕,用 PSNR 证明:字确实画上去了,而且只画在画面下方"""

    def _psnr(self, a, b, crop=''):
        ff = server.find_ffmpeg()
        chain = ''
        pair = '[0:v][1:v]'
        if crop:
            chain = '[0:v]%s[x];[1:v]%s[y];' % (crop, crop)
            pair = '[x][y]'
        r = subprocess.run([ff, '-hide_banner', '-i', a, '-i', b, '-filter_complex',
                            chain + pair + 'psnr', '-f', 'null', '-'], capture_output=True)
        text = r.stderr.decode('utf-8', 'replace')
        m = re.search(r'average:([0-9.]+|inf)', text)
        self.assertIsNotNone(m, 'PSNR 没算出来:' + text[-300:])
        return float('inf') if m.group(1) == 'inf' else float(m.group(1))

    def test_subtitle_lands_on_the_bottom_and_leaves_the_top_alone(self):
        ff = server.find_ffmpeg()
        with tempfile.TemporaryDirectory() as temp_dir:
            src = pathlib.Path(temp_dir) / 'src.mp4'
            out = pathlib.Path(temp_dir) / 'out.mp4'
            subprocess.run([ff, '-y', '-f', 'lavfi', '-i', 'color=c=0x335577:s=640x360:d=2:r=24',
                            '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '2',
                            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(src)],
                           capture_output=True, check=True)

            cues = server.subtitle_cues([(0.2, 1.8, '第一句字幕测试')])
            server.burn_subtitles(str(src), cues, str(out))

            self.assertAlmostEqual(server.media_seconds(str(out)), 2.0, delta=0.3, msg='时长不该变')
            bottom = self._psnr(str(src), str(out), 'crop=iw:ih/3:0:ih*2/3')
            top = self._psnr(str(src), str(out), 'crop=iw:ih*2/3:0:0')
            self.assertLess(bottom, 45, '画面下方应该有明显变化(字幕烧上去了),实际 %s dB' % bottom)
            self.assertGreater(top, 45, '画面上方不该被动,实际 %s dB' % top)

            probe = subprocess.run([server.find_ffprobe() or ff, '-v', 'error', '-show_entries',
                                    'stream=codec_type', '-of', 'csv=p=0', str(out)], capture_output=True)
            kinds = probe.stdout.decode('utf-8', 'replace')
            self.assertIn('video', kinds)
            self.assertIn('audio', kinds, '烧字幕不能把音轨弄丢')


if __name__ == '__main__':
    unittest.main()
