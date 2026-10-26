import { buildDevProcessSpecs } from './devProcesses.mjs'
import { createDevSupervisor } from './devSupervisor.mjs'

const root = process.cwd()
const forwardedArgs = process.argv.slice(2)
const specs = buildDevProcessSpecs(root, forwardedArgs)

const supervisor = createDevSupervisor(specs)

process.on('SIGINT', () => supervisor.stop(0))
process.on('SIGTERM', () => supervisor.stop(0))
