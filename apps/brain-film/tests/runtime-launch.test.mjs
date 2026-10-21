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
