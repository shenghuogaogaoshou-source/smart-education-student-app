import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const SKIPPED_DIRECTORIES = new Set([
  '__pycache__',
  '.cache',
  '.pytest_cache',
  'pip-cache',
  'site-packages',
])

function assertAbsoluteDirectory(sourceRoot, executableName) {
  const root = resolve(sourceRoot)
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Runtime source directory does not exist: ${root}`)
  }
  const executable = join(root, executableName)
  if (!statSync(executable, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Runtime executable is missing: ${executable}`)
  }
  return root
}

function assertSafeDestination(sourceRoot, destinationRoot) {
  const source = resolve(sourceRoot)
  const destination = resolve(destinationRoot)
  const sourceWithSeparator = `${source}${sep}`.toLocaleLowerCase()
  const destinationWithSeparator = `${destination}${sep}`.toLocaleLowerCase()

  if (source === destination) {
    throw new Error(`Runtime destination must differ from source: ${destination}`)
  }
  if (
    destinationWithSeparator.startsWith(sourceWithSeparator) ||
    sourceWithSeparator.startsWith(destinationWithSeparator)
  ) {
    throw new Error(`Runtime source and destination must not contain each other`)
  }
  return destination
}

function copyFiltered(sourceRoot, destinationRoot) {
  const root = resolve(sourceRoot)

  function copy(currentRoot, currentRelative = '') {
    for (const entry of readdirSync(join(currentRoot, currentRelative), {
      withFileTypes: true,
    })) {
      const entryRelative = join(currentRelative, entry.name)
      const source = join(root, entryRelative)
      const destination = join(destinationRoot, entryRelative)

      if (entry.isSymbolicLink()) {
        throw new Error(`Runtime source contains a symbolic link: ${source}`)
      }
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue
        mkdirSync(destination, { recursive: true })
        copy(root, entryRelative)
        continue
      }
      if (entry.isFile()) {
        if (/\.pyc$/i.test(entry.name)) continue
        mkdirSync(dirname(destination), { recursive: true })
        cpSync(source, destination)
      }
    }
  }

  copy(root)
}

function resetDestination(destinationRoot) {
  rmSync(destinationRoot, { recursive: true, force: true })
  mkdirSync(destinationRoot, { recursive: true })
}

function findLicense(root, names = ['LICENSE', 'LICENSE.txt']) {
  return names
    .map((name) => join(root, name))
    .find((candidate) => existsSync(candidate))
}

export function resolveRuntimeSources(env = process.env) {
  const nodeRoot = resolve(env.ZHIYA_PORTABLE_NODE_ROOT || dirname(process.execPath))
  const pythonRoot = resolve(
    env.ZHIYA_PORTABLE_PYTHON_ROOT ||
      runAndRequire(
        'py',
        ['-3.12', '-c', 'import sys; print(sys.base_prefix)'],
        'Python 3.12 was not found; set ZHIYA_PORTABLE_PYTHON_ROOT',
      ),
  )
  const ffmpegBinRoot = resolve(
    env.ZHIYA_PORTABLE_FFMPEG_ROOT ||
      dirname(
        runAndRequire(
          'where.exe',
          ['ffmpeg'],
          'FFmpeg was not found; set ZHIYA_PORTABLE_FFMPEG_ROOT',
        )
          .split(/\r?\n/)
          .find(Boolean),
      ),
  )

  return {
    nodeRoot: assertAbsoluteDirectory(nodeRoot, 'node.exe'),
    pythonRoot: assertAbsoluteDirectory(pythonRoot, 'python.exe'),
    ffmpegBinRoot: assertAbsoluteDirectory(ffmpegBinRoot, 'ffmpeg.exe'),
  }
}

export function copyNodeRuntime(sourceRoot, destinationRoot) {
  const source = assertAbsoluteDirectory(sourceRoot, 'node.exe')
  const npmCli = join(source, 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(npmCli)) {
    throw new Error(`Node.js npm CLI is missing: ${npmCli}`)
  }

  const destination = assertSafeDestination(source, destinationRoot)
  resetDestination(destination)
  copyFiltered(source, destination)

  const sourceLicense = findLicense(source)
  if (sourceLicense) {
    cpSync(sourceLicense, join(destination, 'LICENSE'))
  } else {
    const npmLicense = join(source, 'node_modules', 'npm', 'LICENSE')
    if (existsSync(npmLicense)) {
      cpSync(npmLicense, join(destination, 'LICENSE-npm.txt'))
    }
    writeFileSync(
      join(destination, 'NODE-LICENSE-NOTICE.txt'),
      'Node.js is distributed under the Node.js license.\n' +
        'Official license: https://github.com/nodejs/node/blob/main/LICENSE\n',
      'utf8',
    )
  }

  return destination
}

export function copyPythonRuntime(sourceRoot, destinationRoot) {
  const source = assertAbsoluteDirectory(sourceRoot, 'python.exe')
  const destination = assertSafeDestination(source, destinationRoot)
  resetDestination(destination)
  copyFiltered(source, destination)

  const license = findLicense(source)
  if (license) {
    cpSync(license, join(destination, 'LICENSE.txt'))
  }

  return destination
}

export function copyFfmpegRuntime(sourceBinRoot, destinationRoot) {
  const source = assertAbsoluteDirectory(sourceBinRoot, 'ffmpeg.exe')
  if (!existsSync(join(source, 'ffprobe.exe'))) {
    throw new Error(`FFprobe is missing: ${join(source, 'ffprobe.exe')}`)
  }

  const destination = assertSafeDestination(source, destinationRoot)
  resetDestination(destination)
  cpSync(join(source, 'ffmpeg.exe'), join(destination, 'ffmpeg.exe'))
  cpSync(join(source, 'ffprobe.exe'), join(destination, 'ffprobe.exe'))

  const license =
    findLicense(source) ||
    findLicense(dirname(source), ['LICENSE', 'LICENSE.txt', 'COPYING'])
  if (license) {
    cpSync(license, join(destination, 'LICENSE'))
  } else {
    writeFileSync(
      join(destination, 'LICENSE-NOTICE.txt'),
      'FFmpeg license information: https://ffmpeg.org/legal.html\n',
      'utf8',
    )
  }

  return destination
}

function runAndRequire(command, args, errorMessage) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
  })
  const output = result.stdout?.trim()
  if (result.status !== 0 || !output) {
    throw new Error(errorMessage)
  }
  return output
}

export function verifyPortableRuntime(
  runtimeRoot,
  commandRunner = spawnSync,
) {
  const root = resolve(runtimeRoot)
  const nodePath = join(root, 'node', 'node.exe')
  const npmCliPath = join(root, 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const pythonPath = join(root, 'python', 'python.exe')
  const ffmpegPath = join(root, 'ffmpeg', 'ffmpeg.exe')
  const ffprobePath = join(root, 'ffmpeg', 'ffprobe.exe')

  const commands = {
    node: { command: nodePath, args: ['--version'], path: nodePath },
    npm: { command: nodePath, args: [npmCliPath, '--version'], path: npmCliPath },
    python: { command: pythonPath, args: ['--version'], path: pythonPath },
    ffmpeg: { command: ffmpegPath, args: ['-version'], path: ffmpegPath },
    ffprobe: { command: ffprobePath, args: ['-version'], path: ffprobePath },
  }
  const versions = {}

  for (const [name, spec] of Object.entries(commands)) {
    if (!existsSync(spec.path)) {
      throw new Error(`Portable runtime file is missing: ${spec.path}`)
    }
    const result = commandRunner({
      command: spec.command,
      args: spec.args,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
    })
    if (result.status !== 0) {
      throw new Error(
        `Portable runtime verification failed for ${name}: ${result.stderr || result.stdout}`,
      )
    }
    versions[name] = String(result.stdout).trim().split(/\r?\n/)[0]
  }

  return { nodePath, versions }
}
