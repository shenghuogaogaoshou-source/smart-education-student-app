"""HTTP 层与静态托管的回归测试(把这些坑钉死,别再回来)。
   用法:python -m unittest discover -s tests -p "test_*.py" """
import base64
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


class MethodGateTests(unittest.TestCase):
    def test_paid_endpoints_only_accept_post(self):
        """以前 GET /api/story 这种会被直接执行:任何 <img src> 都能烧钱"""
        for path in ('/api/story', '/api/synopsis', '/api/polish', '/api/image',
                     '/api/tts', '/api/video', '/api/film', '/api/film/stitch'):
            self.assertEqual(server.allowed_methods(path), {'POST'}, path)

    def test_read_endpoints_stay_read_only(self):
        self.assertEqual(server.allowed_methods('/api/health'), {'GET'})
        self.assertEqual(server.allowed_methods('/api/config'), {'GET'})
        self.assertEqual(server.allowed_methods('/api/video/cgt-1'), {'GET'})
        self.assertEqual(server.allowed_methods('/api/films/x.mp4'), {'GET'})

    def test_works_supports_list_save_and_delete(self):
        self.assertEqual(server.allowed_methods('/api/works'), {'GET', 'POST'})
        self.assertEqual(server.allowed_methods('/api/works/f1'), {'GET', 'DELETE'})

    def test_unknown_path_is_read_only(self):
        self.assertEqual(server.allowed_methods('/api/whatever'), {'GET'})


class RangeTests(unittest.TestCase):
    def test_no_range_means_whole_file_and_not_partial(self):
        self.assertEqual(server.parse_range('', 1024), (0, 1023, False))
        self.assertEqual(server.parse_range(None, 500), (0, 499, False))

    def test_suffix_range_reads_from_the_end(self):
        """拖进度条到末尾时以前会拿到片头"""
        self.assertEqual(server.parse_range('bytes=-100', 1024), (924, 1023, True))

    def test_reversed_range_is_rejected_instead_of_negative_length(self):
        """以前会回 206 + Content-Length: -49"""
        self.assertIsNone(server.parse_range('bytes=100-50', 1024)[0])

    def test_range_beyond_end_is_rejected(self):
        self.assertIsNone(server.parse_range('bytes=2000-3000', 1024)[0])
        self.assertIsNone(server.parse_range('bytes=-0', 1024)[0])

    def test_open_ended_range_goes_to_the_end(self):
        self.assertEqual(server.parse_range('bytes=100-', 1024), (100, 1023, True))

    def test_garbage_range_falls_back_to_whole_file_without_206(self):
        self.assertEqual(server.parse_range('bytes=abc', 1024), (0, 1023, False))
        self.assertEqual(server.parse_range('pages=1-2', 1024), (0, 1023, False))


class LimitAndClampTests(unittest.TestCase):
    def test_limit_parsing_never_500s_or_goes_negative(self):
        self.assertEqual(server.parse_limit('abc'), 100)
        self.assertEqual(server.parse_limit('-1'), 1)
        self.assertEqual(server.parse_limit('0'), 1)
        self.assertEqual(server.parse_limit('5'), 5)
        self.assertEqual(server.parse_limit('99999'), 1000)
        self.assertEqual(server.parse_limit(''), 100)

    def test_duration_is_clamped_to_what_the_model_supports(self):
        self.assertEqual(server.clamp_duration('abc'), 5)
        self.assertEqual(server.clamp_duration(5), 5)
        self.assertEqual(server.clamp_duration(10), 10)
        self.assertEqual(server.clamp_duration(60), 10)
        self.assertEqual(server.clamp_duration(-3), 5)

    def test_unknown_resolution_and_ratio_fall_back_to_defaults(self):
        self.assertEqual(server.pick_option('4k', server.VIDEO_RESOLUTIONS, '720p'), '720p')
        self.assertEqual(server.pick_option('16:9', server.VIDEO_RATIOS, '9:16'), '16:9')


class StaticHostingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = pathlib.Path(self.temp.name)
        self.here = base / 'proj'
        (self.here / 'data' / 'films').mkdir(parents=True)
        (self.here / 'index.html').write_text('<h1>hi</h1>', encoding='utf-8')
        (self.here / 'data' / 'bh.db').write_bytes(b'SQLite format 3')
        (self.here / 'data' / 'bh.db-wal').write_bytes(b'WAL')
        (self.here / 'data' / 'films' / 'a.mp4').write_bytes(b'fake')
        # 同名前缀的兄弟目录:以前 startswith(HERE) 会让它被读到
        (base / 'proj-evil').mkdir()
        (base / 'proj-evil' / 'secret.txt').write_text('leaked', encoding='utf-8')
        for p, v in (('HERE', str(self.here)), ('DATA_DIR', str(self.here / 'data'))):
            patcher = patch.object(server, p, v)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_normal_files_are_served(self):
        self.assertIsNotNone(server.resolve_static('/index.html'))
        self.assertIsNotNone(server.resolve_static('/'))

    def test_database_and_its_side_files_are_never_served(self):
        """bh.db-wal / -shm / -journal 以前漏在黑名单外,能直接下载到数据库页内容"""
        for path in ('/data/bh.db', '/data/bh.db-wal', '/data/bh.db-shm', '/data/bh.db-journal'):
            self.assertIsNone(server.resolve_static(path), path)

    def test_rendered_films_go_through_the_range_route_not_static(self):
        self.assertIsNone(server.resolve_static('/data/films/a.mp4'))

    def test_sibling_directory_with_same_prefix_cannot_be_read(self):
        self.assertIsNone(server.resolve_static('/../proj-evil/secret.txt'))

    def test_plain_parent_escape_is_blocked(self):
        self.assertIsNone(server.resolve_static('/../secret.txt'))


class DataUrlTests(unittest.TestCase):
    def test_broken_base64_is_a_client_error_not_a_500(self):
        with tempfile.TemporaryDirectory() as temp_dir, self.assertRaises(server.ApiError) as ctx:
            server._write_data_url('data:image/png;base64,!!!!notb64', temp_dir, 'v0')
        self.assertEqual(ctx.exception.status, 400)

    def test_valid_png_is_written_with_png_extension(self):
        png = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n1234').decode()
        with tempfile.TemporaryDirectory() as temp_dir:
            path = server._write_data_url(png, temp_dir, 'v0')
            self.assertTrue(path.endswith('.png'))
            self.assertTrue(os.path.exists(path))


class StitchGuardTests(unittest.TestCase):
    def test_narration_total_is_capped(self):
        long_line = '很长的旁白' * 60
        with self.assertRaises(server.ApiError) as ctx:
            server.stitch_film([{'videoUrl': 'https://x.volces.com/a.mp4', 'line': long_line}] * 3)
        self.assertEqual(ctx.exception.status, 400)
        self.assertIn('旁白太长', str(ctx.exception))

    def test_empty_segments_are_reported_client_side(self):
        with self.assertRaises(server.ApiError) as ctx:
            server.stitch_film([{'videoUrl': '', 'image': '', 'line': 'x'}])
        self.assertEqual(ctx.exception.status, 400)

    def test_skipped_segments_are_counted(self):
        """既没镜头也没图的格子要如实报给前端,不能悄悄少一段"""
        segments = [
            {'videoUrl': 'https://x.volces.com/a.mp4', 'line': '第一句'},
            {'videoUrl': '', 'image': '', 'line': '第二句'},
        ]
        with patch.object(server, 'find_ffmpeg', return_value=''), self.assertRaises(server.ApiError):
            server.stitch_film(segments)


class DownloadGuardTests(unittest.TestCase):
    def test_only_allowed_hosts_can_be_downloaded(self):
        """以前任意地址都能让服务器去抓(SSRF)"""
        for url in ('http://169.254.169.254/latest/meta-data/', 'https://evil.example.com/x.mp4',
                    'file:///C:/Windows/win.ini', ''):
            with self.assertRaises(server.ApiError) as ctx:
                server._download(url, os.path.join(tempfile.gettempdir(), 'bh-never-download'))
            self.assertEqual(ctx.exception.status, 400, url)

    def test_allowed_hosts_pass_the_gate(self):
        for url in ('https://ark.cn-beijing.volces.com/x.mp4', 'https://cdn.byteimg.com/x.mp4'):
            with patch.object(server, 'opener_for', side_effect=RuntimeError('网络不通(测试桩)')), \
                    self.assertRaises(RuntimeError):
                server._download(url, os.path.join(tempfile.gettempdir(), 'bh-never-download'))


class SafeMessageTests(unittest.TestCase):
    def test_local_paths_are_hidden_from_error_messages(self):
        msg = server.safe_msg(r'合成失败:E:\Users\qinch\AppData\Local\Temp\a.wav Error opening')
        self.assertNotIn('qinch', msg)
        self.assertIn('<本机路径>', msg)
        self.assertNotIn('/home/someone', server.safe_msg('失败:/home/someone/x.wav'))


class VideoSlotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        for name, value in (('DATA_DIR', self.temp.name),
                            ('DB_PATH', str(pathlib.Path(self.temp.name) / 'bh.db')),
                            ('LOG_PATH', str(pathlib.Path(self.temp.name) / 'server.log'))):
            patcher = patch.object(server, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        server.init_db()

    def test_reserved_slot_counts_against_the_limit_only_after_success(self):
        with patch.object(server, 'ENV', {'VIDEO_LIMIT_PER_DAY': '1'}):
            usage_id = server.reserve_video_slot()
            self.assertEqual(server.videos_today(), 0, '占位期间不算已用,余额还留着')
            server.settle_video_slot(usage_id, 'doubao-seedance-2-0-mini-260615', 'task-1')
            self.assertEqual(server.videos_today(), 1)
            with self.assertRaises(server.ApiError) as ctx:
                server.reserve_video_slot()
            self.assertEqual(ctx.exception.status, 429)

    def test_failed_submit_releases_the_slot(self):
        with patch.object(server, 'ENV', {'VIDEO_LIMIT_PER_DAY': '1'}):
            usage_id = server.reserve_video_slot()
            server.release_video_slot(usage_id)
            self.assertEqual(server.videos_today(), 0)
            server.reserve_video_slot()          # 还能再占,说明真的还回去了


if __name__ == '__main__':
    unittest.main()
