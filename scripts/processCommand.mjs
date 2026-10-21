export function npmInvocation({ execPath = process.execPath, npmExecPath = process.env.npm_execpath ?? '' } = {}) {
  if (!npmExecPath) {
    throw new Error('无法定位 npm CLI；请通过 npm run build:games 启动此脚本。')
  }
  return { command: execPath, prefix: [npmExecPath] }
}
