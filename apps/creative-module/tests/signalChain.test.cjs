// 感光器 → IF → 灯泡 这条示例链路的求值逻辑（覆盖"灯暗时灯泡不亮"的回归）
// 用假 canvas 喂像素，直接跑 src/lib/evaluators.ts 里的真实求值器
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadEvaluators() {
  const source = fs.readFileSync('src/lib/evaluators.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    exports: {},
    require: (id) => {
      if (String(id).includes('types/circuit')) {
        return { isSignalActive: (p) => !!p && p.type === 'signal' && p.active === true };
      }
      if (String(id).includes('objectDetector')) {
        return { detect: async () => [] };
      }
      return {};
    },
    Math,
    Date,
    Number,
    String,
    Object,
    Array,
    JSON,
    console,
    setTimeout,
    clearTimeout,
    window: undefined,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

const { evaluateImageClassifier, evaluateIf, EVALUATORS } = loadEvaluators();

/** 造一张纯色画布：level 0~255 */
function solidCanvas(level, w = 40, h = 40) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = level;
    data[i + 1] = level;
    data[i + 2] = level;
    data[i + 3] = 255;
  }
  return {
    width: w,
    height: h,
    getContext: () => ({ getImageData: () => ({ data }) }),
  };
}

const sensorData = (threshold = 50) => ({
  id: 'sensor_1',
  moduleType: 'imageClassifier',
  params: { threshold, sensitivity: 'normal' },
  inputs: {},
  outputs: {},
});

const ifData = (targetLabel) => ({
  id: 'if_1',
  moduleType: 'if',
  params: { targetLabel },
  inputs: {},
  outputs: {},
});

test('光线暗 → 感光器输出「暗」→ IF 目标「暗」输出真信号（灯泡会亮）', () => {
  const sensorOut = evaluateImageClassifier(sensorData(), {
    image: { type: 'image', canvas: solidCanvas(20), ts: 1 },
  });
  assert.equal(sensorOut.outputs.label.value, '暗');

  const ifOut = evaluateIf(ifData('暗'), { label: sensorOut.outputs.label });
  assert.equal(ifOut.outputs.signal.active, true, '暗 + 目标「暗」必须触发');
});

test('光线亮 → 感光器输出「亮」→ IF 目标「暗」不触发（灯泡保持灭）', () => {
  const sensorOut = evaluateImageClassifier(sensorData(), {
    image: { type: 'image', canvas: solidCanvas(240), ts: 1 },
  });
  assert.equal(sensorOut.outputs.label.value, '亮');

  const ifOut = evaluateIf(ifData('暗'), { label: sensorOut.outputs.label });
  assert.equal(ifOut.outputs.signal.active, false);
});

test('目标标签为空串时永远不触发（所以示例链路必须显式设成「暗」）', () => {
  const ifOut = evaluateIf(ifData(''), { label: { type: 'label', value: '暗', ts: 1 } });
  assert.equal(ifOut.outputs.signal.active, false);
});

test('阈值可调：同一张暗画面把阈值调到 0 就判为亮', () => {
  const sensorOut = evaluateImageClassifier(sensorData(0), {
    image: { type: 'image', canvas: solidCanvas(20), ts: 1 },
  });
  assert.equal(sensorOut.outputs.label.value, '亮');
});

test('每个内置模块都有对应的求值器入口（除纯采集/纯终端模块）', () => {
  assert.equal(typeof evaluateImageClassifier, 'function');
  assert.equal(typeof evaluateIf, 'function');
  // 采集类模块由组件自己发数据，不需要求值器
  for (const t of ['camera', 'microphone', 'textInput', 'imageInput', 'timer', 'sceneCamera']) {
    assert.equal(EVALUATORS[t], undefined, `${t} 不应该有求值器`);
  }
  // 终端模块有求值器但只消费数据
  for (const t of ['output', 'buzzer', 'ttsPlayer', 'ledIndicator', 'textDisplay']) {
    assert.equal(typeof EVALUATORS[t], 'function', `${t} 缺少求值器`);
  }
});
