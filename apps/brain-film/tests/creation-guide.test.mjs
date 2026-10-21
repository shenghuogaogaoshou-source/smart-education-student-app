import assert from 'node:assert/strict';
import test from 'node:test';

test('story guide reassures students that their setting stays in the script', async () => {
  const { creationGuide } = await import('../src/creationGuide.js');
  const guide = creationGuide('story', { story: '' });

  assert.match(guide.prompt, /保留.*设定/);
  assert.equal(guide.primaryAction, '生成剧本');
  assert.match(guide.privacyHint, /真实姓名/);
});

test('storyboard guide explains the character-place-action formula', async () => {
  const { creationGuide } = await import('../src/creationGuide.js');

  assert.match(creationGuide('board', {}).prompt, /谁.*在哪里.*做什么/);
});

test('video network errors offer the local recording fallback', async () => {
  const { friendlyGenerationError } = await import('../src/creationGuide.js');
  const result = friendlyGenerationError('video', '连不上上游接口');

  assert.match(result.message, /网络/);
  assert.equal(result.fallbackAction, '本机录制');
});

test('other network errors say the draft is kept and can be retried', async () => {
  const { friendlyGenerationError } = await import('../src/creationGuide.js');
  const result = friendlyGenerationError('image', 'proxy timeout');

  assert.match(result.message, /草稿/);
  assert.equal(result.fallbackAction, '重试');
});
