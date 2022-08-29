import {execa} from 'execa'

export function forwardCommand(followStatus = false) {
  const argv = process.argv
  const separator = argv.findIndex(arg => arg === '--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  function finish({exitCode}: {exitCode: number}) {
    if (followStatus || exitCode !== 0) {
      process.exit(exitCode)
    }
  }
  execa(command.join(' '), {shell: true, stdio: 'inherit'}).then(finish, finish)
}
