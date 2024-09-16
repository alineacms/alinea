import {localUser} from 'alinea/core/User'
import {exec} from 'node:child_process'
import {promisify} from 'node:util'
import PLazy from 'p-lazy'

const execAsync = promisify(exec)

export async function execGit(cwd: string, args: string[]): Promise<string> {
  const {stdout} = await execAsync(`git ${args.join(' ')}`, {cwd})
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
