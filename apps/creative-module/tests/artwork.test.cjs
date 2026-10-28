// 作品检查（本机结构自检）与导出数据：纯逻辑测试，不联网
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const MODS = {
  camera: { type: 'camera', name: 'Camera', subtitle: '摄像头', inputs: [], outputs: [{ id: 'image', label: '图像', type: 'image' }] },
  imageClassifier: { type: 'imageClassifier', name: '感光器', subtitle: '亮度', inputs: [{ id: 'image', label: '图像', type: 'image' }], outputs: [{ id: 'label', label: '标签', type: 'label' }] },
  if: { type: 'if', name: 'IF', subtitle: '条件判断', inputs: [{ id: 'label', label: '标签', type: 'label' }], outputs: [{ id: 'signal', label: '信号', type: 'signal' }] },
  output: { type: 'output', name: 'Lightbulb', subtitle: '灯泡输出', inputs: [{ id: 'signal', label: '信号', type: 'signal' }], outputs: [] },
  counter: { type: 'counter', name: '计数器', subtitle: '累加', inputs: [{ id: 'trigger', label: '触发', type: 'signal' }, { id: 'reset', label: '重置', type: 'signal', optional: true }], outputs: [{ id: 'number', label: '计数值', type: 'number' }] },
  roboticArm: { type: 'roboticArm', name: '机械臂', subtitle: '抓取', inputs: [{ id: 'signal', label: '信号', type: 'signal' }], outputs: [] },
};

function loadArtwork() {
  const source = fs.readFileSync('src/lib/artwork.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    exports: {},
    require: (id) => {
      if (String(id).includes('moduleRegistry')) return { getModule: (t) => MODS[t] };
      if (String(id).includes('aiAssistant')) {
        return { loadAiSettings: () => ({ endpoint: 'x', model: 'y', apiKey: 'z' }) };
      }
      return {};
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.reject(new Error('no network in tests')),
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    console,
    document: { createElement: () => ({}) },
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    Blob: class {},
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

const art = loadArtwork();
const node = (id, moduleType, params = {}, x = 0) => ({ id, type: moduleType, position: { x, y: 0 }, data: { moduleType, params } });
const edge = (id, source, sourceHandle, target, targetHandle, fromType) => ({
  id, source, sourceHandle, target, targetHandle, data: { fromType },
});

// 一条完整能用的链路：感光器 → IF(暗) → 灯泡
const camera = node('cam', 'camera');
const sensor = node('sensor', 'imageClassifier', { threshold: 50 });
const ifNode = node('if1', 'if', { targetLabel: '暗' });
const bulb = node('bulb', 'output', {});
const goodEdges = [
  edge('e1', 'cam', 'image', 'sensor', 'image', 'image'),
  edge('e2', 'sensor', 'label', 'if1', 'label', 'label'),
  edge('e3', 'if1', 'signal', 'bulb', 'signal', 'signal'),
];

test('空画布直接报错', () => {
  const issues = art.localCheck([], []);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'error');
  assert.match(issues[0].title, /空/);
});

test('完整链路只剩"提示"级问题，没有被判成错误', () => {
  const issues = art.localCheck([camera, sensor, ifNode, bulb], goodEdges);
  assert.equal(issues.filter((i) => i.severity === 'error').length, 0);
  assert.ok(issues.some((i) => /IF 的目标是「暗」/.test(i.title)));
});

test('IF 目标标签为空 → 判定为必须修的错误（示例链路的真实坑）', () => {
  const issues = art.localCheck([camera, sensor, node('if2', 'if', { targetLabel: '' }), bulb], goodEdges);
  const err = issues.find((i) => /目标标签/.test(i.title) && i.severity === 'error');
  assert.ok(err, '应报出空目标标签；实际：' + JSON.stringify(issues.map((i) => i.severity + '|' + i.title)));
  assert.match(err.fix, /当标签包含/);
});

test('必需输入没接线 / 孤立元件都会被指出来', () => {
  // counter 只接了 trigger，reset 是可选 → 不该报 reset
  const counter = node('c1', 'counter');
  const issues = art.localCheck([camera, sensor, counter], [edge('e1', 'cam', 'image', 'sensor', 'image', 'image')]);
  const counterIssue = issues.find((i) => /计数器 的输入没接满/.test(i.title));
  assert.ok(counterIssue, '没接 trigger 应报缺失');
  assert.ok(!/重置/.test(counterIssue.detail), '可选端口不应算缺失');
  assert.ok(issues.some((i) => /没有连线/.test(i.title)), '孤立元件应被提示');
});

test('环形连接会被判错', () => {
  const a = node('a', 'if', { targetLabel: '暗' });
  const b = node('b', 'if', { targetLabel: '亮' });
  const issues = art.localCheck([a, b], [
    edge('e1', 'a', 'signal', 'b', 'label', 'signal'),
    edge('e2', 'b', 'signal', 'a', 'label', 'signal'),
  ]);
  assert.ok(issues.some((i) => /有环/.test(i.title)), '应检测到环');
});

test('导出数据包含元件、参数、连线和人可读说明', () => {
  const out = art.buildExport([camera, sensor, ifNode, bulb], goodEdges, '我的小夜灯');
  assert.equal(out.moduleCount, 4);
  assert.equal(out.edgeCount, 3);
  assert.equal(out.nodes.length, 4);
  assert.equal(out.nodes.find((n) => n.id === 'if1').params.targetLabel, '暗');
  assert.equal(out.edges[0].dataType, 'image');
  assert.match(out.summaryText, /我的小夜灯/);
  assert.match(out.summaryText, /感光器/);
});

test('实物图提示词会按元件翻译成现实部件', () => {
  const p = art.buildProductPrompt([camera, sensor, ifNode, bulb], '我的小夜灯');
  assert.match(p, /我的小夜灯/);
  assert.match(p, /摄像头/);
  assert.match(p, /传感器/);
  assert.match(p, /灯泡/);
  assert.match(p, /儿童/);
});

test('AI 审查和实物图能力存在，出图默认走智芽代理且不暴露密钥', () => {
  // normalizeAiCheck 未导出，通过 aiCheckCircuit 才能间接测；这里验证导出面向上仍可用
  assert.equal(typeof art.aiCheckCircuit, 'function');
  assert.equal(typeof art.generateProductImage, 'function');
  assert.equal(art.IMAGE_API_DEFAULTS.endpoint, '/api/ark/images/generations');
  assert.equal(art.IMAGE_API_DEFAULTS.apiKey, '');
});

test('实物图错误会转成儿童可理解的提示，不显示上游技术文本', () => {
  assert.equal(typeof art.describeProductImageError, 'function');
  const message = art.describeProductImageError(new Error('出图接口返回 502：{"error":"provider_error"}'));
  assert.match(message, /作品还在/);
  assert.match(message, /稍后再试/);
  assert.doesNotMatch(message, /provider_error|502/);
});

test('实物图请求使用当前图像服务支持的最小以上尺寸', () => {
  assert.equal(art.IMAGE_API_DEFAULTS.size, '2048x2048');
});
