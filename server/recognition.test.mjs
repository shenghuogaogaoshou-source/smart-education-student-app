import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRecognition, validateResult, parseRecognitionResult, recognize } from './recognition.mjs'
test('rejects unsupported tools, empty or oversized materials and invalid images', () => {
  for (const body of [{ tool: 'unknown', text: 'x' }, { tool: 'solve' }, { tool: 'ocr', text: 'x' }, { tool: 'check', text: 'a'.repeat(4001) }, { tool: 'object', image: 'https://example.com/x' }]) assert.throws(() => validateRecognition(body))
  assert.equal(validateRecognition({ tool: 'translate', text: ' Hello ', target: '英语' }).text, 'Hello')
})
test('requires evidence and method summary in provider result', () => {
  assert.throws(() => validateResult({ title: 'x', output: 'x' }))
  assert.throws(() => validateResult({ title: 'x', output: 'x', uncertainty: 'x', evidence: [], steps: [] }))
  assert.equal(validateResult({ title: 'x', output: 'x', uncertainty: 'x', evidence: ['x'], steps: [{ title: 'x', detail: 'x' }] }).title, 'x')
})
test('requires learning extensions for all five educational tools', () => {
  const base = { sourceText: 'leaf', title: '叶片', output: '一片叶子', uncertainty: '品种不确定', evidence: ['叶脉'], steps: [{ title: '观察', detail: '看到叶脉' }] }
  assert.throws(() => validateResult(base, 'object'))
  const introduction = { overview: '叶片是植物的一部分。', funFact: '叶脉可以输送水和养分。', question: '叶脉像什么形状？' }
  assert.deepEqual(validateResult({ ...base, introduction }, 'object').introduction, introduction)
  for (const tool of ['ocr', 'solve', 'translate', 'check']) {
    assert.throws(() => validateResult(base, tool))
    assert.deepEqual(validateResult({ ...base, introduction }, tool).introduction, introduction)
  }
  assert.equal(validateResult(base, 'scan').introduction, undefined)
})

test('accepts decoded scan text for AI explanation', () => {
  assert.equal(validateRecognition({ tool: 'scan', text: 'https://example.com/learn' }).tool, 'scan')
  assert.throws(() => validateRecognition({ tool: 'scan', text: '' }))
})

test('accepts fenced JSON and text line arrays without losing text', () => {
  const data = { title: '文字', output: ['第一行', '第二行'], evidence: ['原图'], steps: [{ title: '读取', detail: '按行读取' }], introduction: { overview: '说明', funFact: '知识', question: '问题' } }
  const result = parseRecognitionResult('```json\n' + JSON.stringify(data) + '\n```', 'ocr')
  assert.equal(result.output, '第一行\n第二行')
  assert.ok(result.uncertainty)
})
test('retries truncated provider response and includes extensions', async (t) => {
  const original = process.env.VISION_API_KEY
  process.env.VISION_API_KEY = 'test-only'
  const base = process.env.VISION_BASE_URL, model = process.env.VISION_MODEL
  process.env.VISION_BASE_URL = 'https://example.test/v1'; process.env.VISION_MODEL = 'test'
  t.after(() => { for (const [key, value] of Object.entries({ VISION_API_KEY: original, VISION_BASE_URL: base, VISION_MODEL: model })) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  let calls = 0
  const result = { title: '题目', output: '20', evidence: ['12和8'], steps: [{ title: '相加', detail: '12+8=20' }], introduction: { overview: '加法', funFact: '求和', question: '如何检查？' } }
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++
    assert.equal(JSON.parse(options.body).max_tokens, calls === 1 ? 6000 : 10000)
    return { ok: true, json: async () => ({ choices: [{ finish_reason: calls === 1 ? 'length' : 'stop', message: { content: calls === 1 ? '{' : JSON.stringify(result) } }] }) }
  })
  assert.ok((await recognize({ tool: 'solve', text: '12+8' })).introduction)
  assert.equal(calls, 2)
})

test('uses DashScope qwen3-vl-plus with a 90 second timeout and retries one provider failure', async () => {
  const calls = []
  const timeoutValues = []
  const result = { title: '叶子', output: '这是叶片。', uncertainty: '请对照原图。', evidence: ['能看到叶脉'], steps: [{ title: '观察', detail: '先看形状和叶脉' }], introduction: { overview: '叶片帮助植物制造养分。', funFact: '叶脉还能运输水分。', question: '叶脉像什么形状？' } }
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (calls.length === 1) return new Response('temporary', { status: 503 })
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] }), { status: 200 })
  }
  const answer = await recognize({ tool: 'object', image: 'data:image/png;base64,AAAA' }, {
    apiKey: 'fixture',
    fetchImpl,
    timeoutSignalFactory: (ms) => { timeoutValues.push(ms); return undefined },
  })
  assert.equal(answer.title, '叶子')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
  assert.equal(JSON.parse(calls[0].options.body).model, 'qwen3-vl-plus')
  assert.deepEqual(timeoutValues, [90000, 90000])
})

test('returns a safe local result after both vision attempts fail', async () => {
  let calls = 0
  const result = await recognize({ tool: 'ocr', image: 'data:image/png;base64,AAAA' }, {
    apiKey: 'fixture',
    fetchImpl: async () => { calls += 1; throw new Error('network down') },
    timeoutSignalFactory: () => undefined,
  })
  assert.equal(calls, 2)
  assert.match(result.title, /暂时/)
  assert.match(result.output, /重新拍摄|稍后重试/)
  assert.equal(result.evidence.length > 0, true)
  assert.equal(result.steps.length > 0, true)
})

