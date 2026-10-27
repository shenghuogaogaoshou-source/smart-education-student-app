import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

function viteCli(appRoot) {
  const appRequire = createRequire(join(appRoot, 'package.json'))
  return appRequire.resolve('vite/package.json').replace(/package\.json$/, 'bin/vite.js')
}

export function buildFrontendSpecs(root = process.cwd()) {
  const brainFilmRoot = join(root, 'apps', 'brain-film')
  const creativeModuleRoot = join(root, 'apps', 'creative-module')
  return [
    { name: 'zhiya-web', cwd: root, args: [viteCli(root)] },
    { name: 'brain-film', cwd: brainFilmRoot, args: [viteCli(brainFilmRoot)] },
    { name: 'creative-module', cwd: creativeModuleRoot, args: [viteCli(creativeModuleRoot)] },
  ]
}

function start() {
  const root = resolve(process.cwd())
  const children = []
  let stopping = false

  const stop = (code = 0) => {
    if (stopping) return
    stopping = true
    for (const child of children) {
      if (!child.killed) child.kill()
    }
    setTimeout(() => process.exit(code), 150)
  }

  for (const spec of buildFrontendSpecs(root)) {
    const child = spawn(process.execPath, spec.args, {
      cwd: spec.cwd,
      stdio: 'inherit',
      shell: false,
    })
    children.push(child)
    child.on('exit', (code) => {
      if (!stopping) stop(code ?? 1)
    })
  }

  process.on('SIGINT', () => stop(0))
  process.on('SIGTERM', () => stop(0))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
