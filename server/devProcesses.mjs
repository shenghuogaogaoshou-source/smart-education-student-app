import { existsSync } from 'node:fs'
import { join } from 'node:path'

function processSpec(name, cwd, args, command = process.execPath, env = {}) {
  return { name, cwd, command, args, env }
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

export function buildDevProcessSpecs(root, forwardedArgs) {
  const rootVite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  const brainFilmRoot = join(root, 'apps', 'brain-film')
  const creativeModuleRoot = join(root, 'apps', 'creative-module')

  return [
    processSpec('ai-proxy', root, [join(root, 'server', 'ai-proxy.mjs')]),
    processSpec(
      'brain-api',
      brainFilmRoot,
      ['server.py', '--host', '127.0.0.1', '--port', '8766'],
      pythonExecutable(),
      { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    ),
    processSpec('zhiya-web', root, [rootVite, ...forwardedArgs]),
    processSpec('brain-film', brainFilmRoot, [
      join(brainFilmRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      '5191',
      '--strictPort',
    ]),
    processSpec('creative-module', creativeModuleRoot, [
      join(creativeModuleRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      '5192',
      '--strictPort',
    ]),
  ]
}
