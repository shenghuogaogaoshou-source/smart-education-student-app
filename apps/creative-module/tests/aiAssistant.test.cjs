// AI 助手：提示词解析与模块定义校验（不联网，纯逻辑测试）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadAi() {
  const source = fs.readFileSync('src/lib/aiAssistant.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    exports: {},
    require: (id) => {
      // 只用到 customModules 里的安全检查；其余（类型）都是 type-only，已被擦除
      if (String(id).includes('customModules')) {
        return {
          validateCode: (src) =>
            /\bwindow\b|\bdocument\b|\bfetch\s*\(/.test(src)
              ? { ok: false, reason: 'dangerous api' }
              : { ok: true },
        };
      }
      return {};
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

const ai = loadAi();
// vm 里造出来的对象属于另一个 realm，deepStrictEqual 会比原型；统一转成纯数据再比
const plain = (v) => JSON.parse(JSON.stringify(v));

test('解析纯 JSON 与带 ```json 围栏的返回', () => {
  assert.deepEqual(plain(ai.parseJsonPayload('{"name":"A"}')), { name: 'A' });
  assert.deepEqual(plain(ai.parseJsonPayload('```json\n{"name":"B"}\n```')), { name: 'B' });
  assert.deepEqual(plain(ai.parseJsonPayload('好的：{"name":"C"} 以上')), { name: 'C' });
  assert.throws(() => ai.parseJsonPayload('完全不是 JSON'), /不是有效 JSON/);
});

test('合法定义会被规整：名称截断、分类兜底、端口类型过滤', () => {
  const draft = ai.normalizeDraft({
    name: '  TempAlarm  ',
    subtitle: '温度报警',
    category: '不存在的分类',
    icon: '不存在的图标',
    accent: '#123456',
    description: '温度超过阈值就报警',
    explanation: '像体温计',
    inputs: [
      { id: 'value', label: '温度', type: 'number' },
      { id: 'bad id!', label: '非法', type: 'number' },
      { id: 'dup', label: '重复', type: 'signal' },
      { id: 'dup', label: '重复2', type: 'signal' },
      { id: 'weird', label: '怪类型', type: 'spaceship' },
    ],
    outputs: [{ id: 'signal', label: '报警', type: 'signal' }],
    params: [
      { id: 'threshold', label: '阈值', type: 'number', default: '30', min: 0, max: 100, step: 1 },
      { id: 'mode', label: '模式', type: 'select', default: 'a', options: [{ label: 'A', value: 'a' }] },
      { id: 'broken', label: '空选项', type: 'select', options: [] },
    ],
    code: "const v = Number(inputs.value?.value ?? 0)\nreturn { outputs: { signal: { type: 'signal', active: v > Number(params.threshold ?? 30) } }, message: 'ok' }",
  });

  assert.equal(draft.name, 'TempAlarm');
  assert.equal(draft.category, 'logic', '未知分类回落到 logic');
  assert.equal(draft.icon, 'Boxes', '未知图标回落到 Boxes');
  assert.equal(draft.accent, '#a888c7', '非法颜色回落到默认色');
  assert.deepEqual(plain(draft.inputs.map((p) => p.id)), ['value', 'dup'], '非法 id / 重复 id / 未知类型被丢弃');
  assert.equal(draft.params.length, 2, '没有选项的 select 参数被丢弃');
  assert.equal(draft.params[0].default, 30, '数字参数默认值被转成数字');
  assert.equal(draft.params[1].default, 'a');
});

test('没有输出端口的定义被拒绝（画布上没法接线）', () => {
  assert.throws(
    () => ai.normalizeDraft({ name: 'X', outputs: [], code: 'return { outputs: {} }' }),
    /没有输出端口/,
  );
});

test('危险代码被安全预检拦下', () => {
  assert.throws(
    () => ai.normalizeDraft({
      name: 'X',
      outputs: [{ id: 'signal', label: '信号', type: 'signal' }],
      code: "fetch('https://evil.example')",
    }),
    /安全检查/,
  );
});

test('缺少名称或代码时报中文错误', () => {
  assert.throws(() => ai.normalizeDraft({ code: 'return {}' }), /模块名称/);
  assert.throws(() => ai.normalizeDraft({ name: 'X', outputs: [{ id: 's', type: 'signal' }] }), /求值代码/);
});

test('默认通过智芽代理接入 DeepSeek，浏览器端不保存密钥', () => {
  assert.equal(ai.AI_DEFAULTS.endpoint, '/api/deepseek/chat/completions');
  assert.equal(ai.AI_DEFAULTS.apiKey, '');
});
