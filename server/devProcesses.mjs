import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

function processSpec(name, cwd, args, command = process.execPath, env = {}, resilient = false) {
  return { name, cwd, command, args, env, resilient }
}

function pythonExecutable() {
  if (process.env.ZHIYA_PYTHON) return process.env.ZHIYA_PYTHON
  const localAppData = process.env.LOCALAPPDATA
  const candidates = [
    localAppData && join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
    localAppData && join(localAppData, 'Programs', 'Python', 'Python313', 'python.exe'),
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate)) ?? 'python'
}

function resolveViteCli(appRoot) {
  const appRequire = createRequire(join(appRoot, 'package.json'))
  const packagePath = appRequire.resolve('vite/package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const binPath = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.vite
  if (!binPath) throw new Error(`Vite CLI not declared by ${packagePath}`)
  return resolve(dirname(packagePath), binPath)
}

export function buildDevProcessSpecs(root, forwardedArgs) {
  const brainFilmRoot = join(root, 'apps', 'brain-film')
  const creativeModuleRoot = join(root, 'apps', 'creative-module')

  return [
    processSpec('ai-proxy', root, [join(root, 'server', 'ai-proxy.mjs')], process.execPath, {}, true),
    processSpec(
      'brain-api',
      brainFilmRoot,
      ['server.py', '--host', '127.0.0.1', '--port', '8766'],
      pythonExecutable(),
      { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      true,
    ),
    processSpec('zhiya-web', root, [resolveViteCli(root), ...forwardedArgs]),
    processSpec('brain-film', brainFilmRoot, [
      resolveViteCli(brainFilmRoot),
      '--host',
      '127.0.0.1',
      '--port',
      '5191',
      '--strictPort',
    ]),
    processSpec('creative-module', creativeModuleRoot, [
      resolveViteCli(creativeModuleRoot),
      '--host',
      '127.0.0.1',
      '--port',
      '5192',
      '--strictPort',
    ]),
  ]
}
