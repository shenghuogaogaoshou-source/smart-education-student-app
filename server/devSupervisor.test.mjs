import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createDevSupervisor } from './devSupervisor.mjs'

function fakeChild() {
  const child = new EventEmitter()
  child.exitCode = null
  child.killed = false
  child.kill = () => { child.killed = true; child.exitCode = 0 }
  return child
}

test('restarts a resilient AI service without stopping the web app', () => {
  const spawned = []
  const timers = []
  const spawnImpl = () => { const child = fakeChild(); spawned.push(child); return child }
  const supervisor = createDevSupervisor([
    { name: 'ai-proxy', command: 'node', args: [], cwd: '.', env: {}, resilient: true },
    { name: 'zhiya-web', command: 'node', args: [], cwd: '.', env: {} },
  ], {
    spawnImpl,
    setTimer: (callback) => { timers.push(callback); return 1 },
    logger: { error() {}, warn() {}, info() {} },
  })

  spawned[0].emit('exit', 1)
  assert.equal(spawned[1].killed, false)
  assert.equal(timers.length, 1)
  timers[0]()
  assert.equal(spawned.length, 3)
  supervisor.stop()
})

test('stops every child when a core frontend exits', () => {
  const spawned = []
  const spawnImpl = () => { const child = fakeChild(); spawned.push(child); return child }
  let fatalCode = null
  createDevSupervisor([
    { name: 'ai-proxy', command: 'node', args: [], cwd: '.', env: {}, resilient: true },
    { name: 'zhiya-web', command: 'node', args: [], cwd: '.', env: {} },
  ], {
    spawnImpl,
    onFatal: (code) => { fatalCode = code },
    logger: { error() {}, warn() {}, info() {} },
  })

  spawned[1].emit('exit', 2)
  assert.equal(spawned[0].killed, true)
  assert.equal(fatalCode, 2)
})
