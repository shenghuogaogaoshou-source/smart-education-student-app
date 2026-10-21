// 核心契约测试：端口类型兼容 / 可选入端 / 注册表可选端声明
// 与 circuitDraft.test.cjs 同样的做法：把 TS 源码转成 CommonJS 后在 vm 里跑
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, requireStub = () => ({})) {
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, require: requireStub };
  vm.runInNewContext(code, context);
  return context.exports;
}

const circuit = load('src/types/circuit.ts');

test('same types connect, mismatched types do not', () => {
  assert.equal(circuit.canConnect('image', 'image'), true);
  assert.equal(circuit.canConnect('label', 'signal'), false);
  assert.equal(circuit.canConnect('image', 'text'), false);
});

test('number and confidence are interchangeable (both are 0~1/numeric values)', () => {
  assert.equal(circuit.canConnect('number', 'confidence'), true);
  assert.equal(circuit.canConnect('confidence', 'number'), true);
  assert.equal(circuit.canConnect('number', 'label'), false);
});

test('optional input ports do not block evaluation', () => {
  const ports = [
    { id: 'trigger', label: '触发', type: 'signal' },
    { id: 'reset', label: '重置', type: 'signal', optional: true },
  ];
  // 只接了 trigger：reset 是 optional，仍然可以求值（计数器最常用接法）
  assert.equal(circuit.inputsReady(ports, { trigger: { type: 'signal', active: true, ts: 1 } }), true);
  // 必需端口缺失则不求值
  assert.equal(circuit.inputsReady(ports, {}), false);
  // 显式置 undefined 等同于没接
  assert.equal(circuit.inputsReady(ports, { trigger: undefined }), false);
});

test('registry marks optional ports so the gate accepts partial wiring', () => {
  const registry = load('src/lib/moduleRegistry.ts', () => ({}));
  const getModule = registry.getModule;
  assert.equal(typeof getModule, 'function');

  const counter = getModule('counter');
  const reset = counter.inputs.find((p) => p.id === 'reset');
  assert.equal(Boolean(reset && reset.optional), true, 'counter.reset 应标记 optional');

  const textMerge = getModule('textMerge');
  assert.equal(textMerge.inputs.find((p) => p.id === 'text1').optional, undefined, 'text1 是必需端口');
  assert.equal(textMerge.inputs.find((p) => p.id === 'text2').optional, true);
  assert.equal(textMerge.inputs.find((p) => p.id === 'text3').optional, true);

  const buzzer = getModule('buzzer');
  assert.equal(buzzer.inputs.find((p) => p.id === 'text').optional, true, 'buzzer.text 是可选文字');
});

test('level 1 hint step 5 requires the exact label the level needs', () => {
  const levelData = load('src/levels/levelData.ts', () => ({}));
  const level = levelData.getLevel(1);
  const step = level.hints.find((h) => h.step === 5);
  assert.equal(step.expect, 'setParam');
  assert.equal(step.expectParam, 'targetLabel');
  assert.equal(step.expectValue, '垃圾');
});

test('unfinished levels cannot be entered', () => {
  const levelData = load('src/levels/levelData.ts', () => ({}));
  assert.equal(levelData.getLevel(1).comingSoon, undefined);
  for (const id of [2, 3, 4, 5]) {
    assert.equal(levelData.getLevel(id).comingSoon, true, `L${id} 应标记为开发中`);
  }
});

test('every core output port has at least one compatible input port somewhere', () => {
  const registry = load('src/lib/moduleRegistry.ts', () => ({}));
  const modules = Object.values(registry.MODULES).filter((m) => !registry.isPreview(m.type));
  const inputTypes = new Set();
  for (const m of modules) for (const p of m.inputs) inputTypes.add(p.type);
  const connectable = (type) =>
    inputTypes.has(type) || ((type === 'confidence' || type === 'number') && (inputTypes.has('number') || inputTypes.has('confidence')));

  const orphans = [];
  for (const m of modules) {
    for (const p of m.outputs) {
      if (!connectable(p.type)) orphans.push(`${m.type}.${p.id} (${p.type})`);
    }
  }
  assert.deepEqual(orphans, [], '这些输出端口没有任何可连入端: ' + orphans.join(', '));
});
