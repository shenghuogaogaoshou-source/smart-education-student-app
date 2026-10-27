import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import unittest
import uuid
from unittest.mock import patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


def load_server_module():
    module_name = 'brain_film_server_%s' % uuid.uuid4().hex
    spec = importlib.util.spec_from_file_location(module_name, ROOT / 'server.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LocalRuntimeTests(unittest.TestCase):
    def test_cloud_environment_selects_persistent_data_and_video_limit(self):
        with tempfile.TemporaryDirectory() as temp_dir, patch.dict(os.environ, {
            'DATA_DIR': temp_dir,
            'VIDEO_LIMIT_PER_DAY': '12',
        }, clear=False):
            module = load_server_module()

        self.assertEqual(module.DATA_DIR, os.path.abspath(temp_dir))
        self.assertEqual(module.DB_PATH, os.path.join(os.path.abspath(temp_dir), 'bh.db'))
        self.assertEqual(module.FILM_DIR, os.path.join(os.path.abspath(temp_dir), 'films'))
        self.assertEqual(module.LOG_PATH, os.path.join(os.path.abspath(temp_dir), 'server.log'))
        self.assertEqual(module.video_day_limit(), 12)

    def test_work_survives_reloading_the_service_from_the_same_data_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir, patch.dict(os.environ, {
            'DATA_DIR': temp_dir,
        }, clear=False):
            first = load_server_module()
            first.init_db()
            with first.db() as connection:
                connection.execute(
                    'INSERT INTO works(id,title,director,style,pages,created_at,updated_at,payload) '
                    'VALUES(?,?,?,?,?,?,?,?)',
                    ('cloud-work', '云端作品', '测试学生', '童话', 1, '2026-10-27', '2026-10-27', '{}'),
                )

            second = load_server_module()
            second.init_db()
            with second.db() as connection:
                row = connection.execute('SELECT title FROM works WHERE id=?', ('cloud-work',)).fetchone()

        self.assertIsNotNone(row)
        self.assertEqual(row['title'], '云端作品')

    def test_load_env_reads_proxy_and_allows_environment_override(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = pathlib.Path(temp_dir) / '.env'
            env_file.write_text(
                'ARK_MODEL=file-model\nHTTPS_PROXY=http://127.0.0.1:7890\n',
                encoding='utf-8',
            )
            actual = server.load_env(
                path=str(env_file),
                environ={'ARK_MODEL': 'process-model'},
            )

        self.assertEqual(actual['ARK_MODEL'], 'process-model')
        self.assertEqual(actual['HTTPS_PROXY'], 'http://127.0.0.1:7890')

    def test_modules_exposes_models_but_not_credentials(self):
        with patch.object(server, 'ENV', {
            'ZHIPU_API_KEY': 'secret-value',
            'HTTPS_PROXY': 'http://private-proxy',
        }), patch.object(server, 'net_ok', return_value=True):
            payload = server.modules()

        serialized = json.dumps(payload)
        self.assertIn('model', payload['story'])
        self.assertNotIn('ZHIPU_API_KEY', serialized)
        self.assertNotIn('secret-value', serialized)
        self.assertNotIn('private-proxy', serialized)

    def test_proxy_status_label_does_not_echo_proxy_address(self):
        label = server.proxy_status_label('http://127.0.0.1:7890')
        self.assertEqual(label, '本机代理已配置')
        self.assertNotIn('7890', label)


if __name__ == '__main__':
    unittest.main()
