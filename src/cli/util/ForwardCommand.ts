import {runForwarded, watchParent} from './RunForwarded.js'

export function forwardCommand():
  | ((env?: Record<string, string>) => void)
  | undefined {
  const argv = process.argv
  const separator = argv.indexOf('--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  // Don't start the command at all if our parent went away while generating
  const stopWatching = watchParent(() => process.exit(129))
  return (env: Record<string, string> = {}) => {
    stopWatching()
    runForwarded(command.join(' '), {...process.env, ...env})
  }
}
