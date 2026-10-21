const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/circuitDraft.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
// modules：假 moduleRegistry，可给某个 moduleType 提供 params 定义（用于默认值回填测试）
function setup(value = null, fail = false, modules = {}) {
  const context = {
    exports: {},
    require: () => ({ getModule: type => type in modules ? modules[type] : type === 'text' ? {} : undefined }),
    localStorage: { getItem: () => value, setItem: (_, next) => { if (fail) throw Error('full'); value = next; } },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
// vm 里创建的对象属于另一个 realm，deepEqual 会因原型不同失败 —— 统一走 JSON 往返再比较
const plain = x => JSON.parse(JSON.stringify(x));
const node = { id: 'one', type: 'text', position: { x: 10, y: 20 }, data: { moduleType: 'text', params: { text: 'hello' }, codeOverride: 'return 1', inputs: { image: 'private-frame' }, outputs: { value: 12 }, aiState: { status: 'running' } } };
test('draft keeps configuration but discards inference and camera packets', () => {
  const draft = setup().captureDraft([node], []);
  assert.equal(draft.nodes[0].data.params.text, 'hello');
  assert.equal(draft.nodes[0].data.codeOverride, 'return 1');
  assert.equal(draft.nodes[0].data.aiState.status, 'idle');
  assert.equal(JSON.stringify(draft).includes('private-frame'), false);
});
test('corrupt drafts fall back without crashing', () => {
  assert.equal(setup('{broken').readDraft(), null);
  assert.equal(setup('{"version":99}').readDraft(), null);
});
test('missing modules and dangling edges are removed', () => {
  const raw = { version: 1, nodes: [node, { ...node, id: 'unknown', data: { ...node.data, moduleType: 'removed' } }], edges: [{ id: 'edge', source: 'one', target: 'unknown' }] };
  const draft = setup(JSON.stringify(raw)).readDraft();
  assert.equal(draft.nodes.length, 1);
  assert.equal(draft.edges.length, 0);
});
test('empty canvas is a valid saved draft', () => {
  const draft = setup('{"version":1,"nodes":[],"edges":[]}').readDraft();
  assert.equal(draft.nodes.length, 0);
});
test('storage failure is reported without throwing', () => {
  assert.equal(setup(null, true).saveDraft({ version: 1, nodes: [], edges: [] }), false);
});
test('node id survives capture and restore inside data', () => {
  // 有状态求值器用 data.id 做状态键：只存 node.id 的话恢复后状态会串到 'anonymous'
  const captured = setup().captureDraft([node], []);
  assert.equal(captured.nodes[0].data.id, 'one');
  const restored = setup(JSON.stringify(captured)).readDraft();
  assert.equal(restored.nodes[0].data.id, 'one');
  assert.equal(restored.nodes[0].id, 'one');
});
test('edge type metadata survives a save and restore round trip', () => {
  const edge = { id: 'e1', source: 'one', target: 'two', sourceHandle: 'out', targetHandle: 'in', type: 'dataflow', data: { fromType: 'label' } };
  const api = setup();
  assert.equal(api.saveDraft(api.captureDraft([node, { ...node, id: 'two' }], [edge])), true);
  const restored = api.readDraft();
  assert.equal(restored.edges.length, 1);
  assert.deepEqual(plain(restored.edges[0].data), { fromType: 'label' });
  assert.equal(restored.edges[0].data.fromType, 'label');
  assert.equal(restored.edges[0].sourceHandle, 'out');
  assert.equal(restored.edges[0].targetHandle, 'in');
});
test('missing params are back-filled from the registry while saved values win', () => {
  const modules = { text: { type: 'text', params: [{ id: 'text', label: '文本', type: 'string', default: '默认文本' }, { id: 'size', label: '字号', type: 'number', default: 24 }] } };
  const raw = { version: 1, nodes: [{ ...node, data: { ...node.data, params: { text: 'hello' } } }], edges: [] };
  const restored = setup(JSON.stringify(raw), false, modules).readDraft();
  // 已保存的 text 保留用户值，新增的 size 用注册表默认值补齐
  assert.deepEqual(plain(restored.nodes[0].data.params), { text: 'hello', size: 24 });
});

for (const version of [1, 2]) test(`v${version} 旧版默认示例草稿会把空的 IF 目标修复为“暗”`, () => {
  const modules = {
    camera: { params: [] },
    imageClassifier: { params: [] },
    if: { params: [{ id: 'targetLabel', label: '目标标签', type: 'string', default: '' }] },
    output: { params: [] },
  };
  const makeNode = (id, moduleType, params = {}) => ({
    id,
    type: moduleType,
    position: { x: 0, y: 0 },
    data: { moduleType, params },
  });
  const raw = {
    version,
    nodes: [
      makeNode('cam', 'camera'),
      makeNode('sensor', 'imageClassifier'),
      makeNode('if1', 'if', { targetLabel: '' }),
      makeNode('bulb', 'output'),
    ],
    edges: [],
  };
  const restored = setup(JSON.stringify(raw), false, modules).readDraft();
  assert.equal(restored.version, 2);
  assert.equal(restored.nodes.find((item) => item.id === 'if1').data.params.targetLabel, '暗');
});
