import {localUser} from '#/core/User.js'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import PLazy from 'p-lazy'

const execFileAsync = promisify(execFile)

export async function execGit(cwd: string, args: string[]): Promise<string> {
  const {stdout} = await execFileAsync('git', args, {cwd})
  return stdout.trim()
}

export function gitUser(cwd: string) {
  return PLazy.from(async () => {
    const [name = localUser.name, email] = (
      await Promise.all([
        execGit(cwd, ['config', '--get', 'user.name']),
        execGit(cwd, ['config', '--get', 'user.email'])
      ]).catch(() => [])
    ).map(res => res ?? undefined)
    return {...localUser, name, email}
  })
}
