import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function pythonCandidates(platform = process.platform) {
  return platform === 'win32'
    ? [
        { command: 'py', prefix: ['-3'] },
        { command: 'python', prefix: [] },
        { command: 'python3', prefix: [] },
      ]
    : [
        { command: 'python3', prefix: [] },
        { command: 'python', prefix: [] },
      ]
}

function findPython() {
  for (const candidate of pythonCandidates()) {
    const probe = spawnSync(candidate.command, [...candidate.prefix, '-c', 'import sys'], {
      stdio: 'ignore',
      shell: false,
    })
    if (!probe.error && probe.status === 0) return candidate
  }
  return null
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const python = findPython()
  if (!python) {
    console.error('未找到可用的 Python 3。请安装 Python 3，或确保 py/python3/python 可执行。')
    process.exit(1)
  }

  const result = spawnSync(
    python.command,
    [...python.prefix, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'],
    { stdio: 'inherit', shell: false },
  )

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}
