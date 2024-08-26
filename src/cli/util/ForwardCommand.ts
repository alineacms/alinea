import {spawn} from 'child_process'

export function forwardCommand(env: Record<string, string> = {}): boolean {
  const argv = process.argv
  const separator = argv.findIndex(arg => arg === '--')
  if (separator === -1) return false
  const command = argv.slice(separator + 1)
  if (command.length === 0) return false
  function finish(code: number) {
    process.exit(code)
  }
  const instance = spawn(command.join(' '), {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env
    }
  })
  instance.on('exit', finish)
  process.on('SIGINT', () => instance.kill('SIGINT'))
  process.on('SIGTERM', () => instance.kill('SIGTERM'))
  return true
}
