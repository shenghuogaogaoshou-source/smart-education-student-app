const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/circuitDraft.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup(value = null, fail = false) {
  const context = { exports: {}, require: () => ({ getModule: type => type === 'text' ? {} : undefined }), localStorage: { getItem: () => value, setItem: (_, next) => { if (fail) throw Error('full'); value = next; } } };
  vm.runInNewContext(code, context);
  return context.exports;
}
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
