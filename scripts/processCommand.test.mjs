import test from 'node:test'
import assert from 'node:assert/strict'
import { npmInvocation } from './processCommand.mjs'

test('通过当前 Node 执行 npm CLI，避免 shell 拼接参数', () => {
  assert.deepEqual(
    npmInvocation({ execPath: 'C:/node/node.exe', npmExecPath: 'C:/node/npm-cli.js' }),
    { command: 'C:/node/node.exe', prefix: ['C:/node/npm-cli.js'] },
  )
})

test('缺少 npm CLI 路径时给出明确错误', () => {
  assert.throws(
    () => npmInvocation({ execPath: 'C:/node/node.exe', npmExecPath: '' }),
    /npm CLI/,
  )
})
