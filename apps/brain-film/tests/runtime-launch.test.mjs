import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('launch script starts the local API before opening the Vite app', () => {
  const script = readFileSync(new URL('../launch.ps1', import.meta.url), 'utf8');

  assert.match(script, /server\.py/);
  assert.match(script, /api\/health/);
  assert.match(script, /npm\.cmd run dev/);
  assert.match(script, /Get-NetTCPConnection -LocalPort \$webPort/);
  assert.match(script, /Start-Process -FilePath npm\.cmd/);
  assert.deepEqual([...readFileSync(new URL('../launch.ps1', import.meta.url)).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test('launch script accepts -Lan for the phone mode launcher', () => {
  const script = readFileSync(new URL('../launch.ps1', import.meta.url), 'utf8');

  /* 启动手机模式.cmd 会传 -Lan;以前 launch.ps1 没这个参数,点了直接报错 */
  assert.match(script, /\[switch\]\$Lan/);
  assert.match(script, /'--lan'/, '局域网模式下后端要绑 0.0.0.0');
  assert.match(script, /\$bindHost/, 'vite 也要跟着换监听地址');
});
