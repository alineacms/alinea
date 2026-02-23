import {spawn} from 'node:child_process'

export function forwardCommand():
  | ((env?: Record<string, string>) => void)
  | undefined {
  const argv = process.argv
  const separator = argv.indexOf('--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  return (env: Record<string, string> = {}) => {
    const instance = spawn(command.join(' '), {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env
      }
    })
    instance.on('exit', code => process.exit(code))
    process.on('SIGINT', () => instance.kill('SIGINT'))
    process.on('SIGTERM', () => instance.kill('SIGTERM'))
  }
}
