import { join } from 'node:path'

function processSpec(name, cwd, args) {
  return { name, cwd, command: process.execPath, args }
}

export function buildDevProcessSpecs(root, forwardedArgs) {
  const rootVite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  const brainFilmRoot = join(root, 'apps', 'brain-film')
  const creativeModuleRoot = join(root, 'apps', 'creative-module')

  return [
    processSpec('ai-proxy', root, [join(root, 'server', 'ai-proxy.mjs')]),
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
