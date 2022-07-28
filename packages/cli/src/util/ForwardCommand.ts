import {execa} from 'execa'

export function forwardCommand() {
  const argv = process.argv
  const separator = argv.findIndex(arg => arg === '--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  execa(command[0], command.slice(1), {stdio: 'inherit'})
}
