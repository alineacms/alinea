import {execSync} from 'node:child_process'

const binary = 'bun'
const args = process.argv.slice(2)
if (args.length === 0) args.push('install')
else if (args.length === 1 && args[0] === 'build') args.unshift('run')
try {
  execSync(`${binary} ${args.join(' ')}`, {stdio: 'inherit'})
} catch (error) {
  if (error.status === 127) console.warn('Install bun from https://bun.sh')
  process.exit(error.status)
}
