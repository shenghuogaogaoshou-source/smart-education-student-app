import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { npmInvocation } from './processCommand.mjs'

const root = process.cwd()
const games = [
  ['@zhiya/brain-film', 'brain-film'],
  ['@zhiya/creative-module', 'creative-module'],
]

for (const [workspace, id] of games) {
  const npm = npmInvocation()
  const build = spawnSync(npm.command, [...npm.prefix, '--workspace', workspace, 'run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
  if (build.status !== 0) {
    process.exit(build.status ?? 1)
  }

  const source = join(root, 'apps', id, 'dist')
  if (!existsSync(join(source, 'index.html'))) {
    throw new Error(`${workspace} 构建后缺少 dist/index.html`)
  }

  const target = join(root, 'dist', 'embedded-games', id)
  rmSync(target, { recursive: true, force: true })
  cpSync(source, target, { recursive: true })
}
