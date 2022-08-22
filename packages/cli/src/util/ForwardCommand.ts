import {execa} from 'execa'

export function forwardCommand(followStatus = false) {
  const argv = process.argv
  const separator = argv.findIndex(arg => arg === '--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  execa(command.join(' '), {shell: true, stdio: 'inherit'}).then(
    ({exitCode}) => {
      if (followStatus || exitCode !== 0) {
        process.exit(exitCode)
      }
    }
  )
}
