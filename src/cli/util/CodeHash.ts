import {hashBlob} from '#/core/source/GitUtils.js'
import {join} from '#/core/util/Paths.js'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'

const exec = promisify(execFile)

// Equals the output of this shell command, which a deploy can compare with
// the hash of the deployed build to skip content-only commits without
// needing the git history:
// git ls-tree -r --full-tree HEAD | grep -v "$(printf '\tcontent/')" |
//   git hash-object --stdin
export async function codeHash(
  cwd: string,
  contentDir: string
): Promise<string | undefined> {
  const git = (...args: Array<string>) =>
    exec('git', args, {cwd, maxBuffer: Infinity}).then(res => res.stdout)
  try {
    const prefix = await git('rev-parse', '--show-prefix')
    const exclude = `\t${join(prefix.trim(), contentDir)}/`
    const tree = await git('ls-tree', '-r', '--full-tree', 'HEAD')
    const code = tree
      .split('\n')
      .filter(line => line && !line.includes(exclude))
      .map(line => `${line}\n`)
    return await hashBlob(new TextEncoder().encode(code.join('')))
  } catch {
    return undefined
  }
}
