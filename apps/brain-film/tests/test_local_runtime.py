import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


class LocalRuntimeTests(unittest.TestCase):
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
