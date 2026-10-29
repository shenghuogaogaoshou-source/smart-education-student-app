import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const launcherRoot = join(
  projectRoot,
  'templates',
  'source-packages',
  'complete',
)

function powershellPath(script) {
  const executable = process.platform === 'win32' ? 'powershell.exe' : 'pwsh'
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(
      executable,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { cwd: projectRoot },
    )
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      rejectResult(new Error('PowerShell contract test timed out'))
    }, 15_000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectResult)
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        rejectResult(new Error(stderr || `PowerShell exited with code ${code}`))
        return
      }
      resolveResult(stdout.trim())
    })
  })
}

test('launcher uses packaged runtimes and starts the unified supervisor', () => {
  const command = readFileSync(join(launcherRoot, '启动.cmd'), 'utf8')
  const start = readFileSync(join(launcherRoot, 'launcher', 'start.ps1'), 'utf8')
  const processes = readFileSync(
    join(launcherRoot, 'launcher', 'process-manager.ps1'),
    'utf8',
  )

  assert.match(command, /%~dp0launcher\\start\.ps1/)
  assert.doesNotMatch(command, /\b(where|npm|py|python|ffmpeg)\b/i)
  assert.match(start, /runtime\\node/)
  assert.match(start, /node\.exe/)
  assert.match(start, /runtime\\python\\python\.exe/)
  assert.match(start, /runtime\\ffmpeg/)
  assert.match(start, /server\/dev\.mjs/)
  assert.match(start, /ZHIYA_NO_BROWSER/)
  for (const functionName of [
    'Get-ZhiyaPortOwner',
    'Test-ZhiyaOwnedProcess',
    'Stop-ZhiyaPortConflict',
    'Stop-ZhiyaProcessTree',
  ]) {
    assert.match(processes, new RegExp(`function ${functionName}`))
  }
})

test(
  'PowerShell contracts distinguish package processes and detect health endpoints',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'zhiya-launcher-'))
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"ok":true}')
    })
    await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady))
    t.after(async () => {
      owned.kill()
      external.kill()
      await Promise.all([once(owned, 'close'), once(external, 'close')])
      server.closeAllConnections()
      await new Promise((resolveClosed) => server.close(resolveClosed))
      rmSync(packageRoot, { recursive: true, force: true })
    })

    const { port } = server.address()
    const ownedScript = join(packageRoot, 'owned-process.mjs')
    writeFileSync(ownedScript, 'setInterval(() => {}, 1000)\n', 'utf8')
    const owned = spawn(process.execPath, [ownedScript], {
      cwd: packageRoot,
      stdio: 'ignore',
    })
    const external = spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      { cwd: packageRoot, stdio: 'ignore' },
    )
    const quote = (value) => value.replaceAll("'", "''")
    const healthFile = join(launcherRoot, 'launcher', 'health-check.ps1')
    const processFile = join(launcherRoot, 'launcher', 'process-manager.ps1')
    const script = [
      `. '${quote(processFile)}'`,
      `. '${quote(healthFile)}'`,
      `Test-ZhiyaOwnedProcess -Pid ${owned.pid} -PackageRoot '${quote(packageRoot)}'`,
      `Test-ZhiyaOwnedProcess -Pid ${external.pid} -PackageRoot '${quote(projectRoot)}'`,
      `Wait-ZhiyaEndpoint -Uri 'http://127.0.0.1:${port}/' -TimeoutSeconds 5`,
    ].join('; ')

    const output = (await powershellPath(script))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    assert.deepEqual(output.slice(-3), ['True', 'False', 'True'])
  },
)
