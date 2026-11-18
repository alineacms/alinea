import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {StagedFile} from '#/core/source/FSSource.js'
import {type GitRepository, gitRepository} from '@alinea/graft/fs'
import {workTreeOf} from '../util/WorkTree.js'

/**
 * The files git's index stages below `dir`, by their path there, so a cold
 * start hashes only the files changed since. None when there is no
 * repository, or when a checkout writes other bytes than git stages (CRLF
 * line endings, a filter): the index then holds the sha of the staged file,
 * not of its bytes on disk.
 */
export async function stagedFiles(
  dir: string
): Promise<Map<string, StagedFile> | undefined> {
  let git: GitRepository | undefined
  try {
    const root = fs.realpathSync(dir)
    const workTree = workTreeOf(root)
    if (!workTree) return undefined
    git = gitRepository(workTree)
    if (converts(workTree, root, git.commonDir)) return undefined
    const prefix = path.relative(workTree, root).replaceAll('\\', '/')
    const below = prefix ? `${prefix}/` : ''
    const result = new Map<string, StagedFile>()
    for (const [file, entry] of await git.index()) {
      if (!file.startsWith(below)) continue
      result.set(file.slice(below.length), entry)
    }
    return result
  } catch {
    // Without a readable index every file is hashed, as before
    return undefined
  } finally {
    git?.close()
  }
}

// Checkouts that write other bytes than git stages: CRLF line endings, or
// filters. Text normalized to LF on the way in checks out as staged on Unix
const conversion = /^\s*(?:autocrlf\s*=\s*true|eol\s*=\s*crlf)/im
const attributes =
  process.platform === 'win32'
    ? /(?:^|\s)(?:text|eol|filter|ident|working-tree-encoding)\b/m
    : /(?:^|\s)(?:eol=crlf|filter|ident|working-tree-encoding)\b/m

/** Whether a checkout may write other bytes than the index stages */
function converts(workTree: string, dir: string, commonDir: string): boolean {
  const read = (file: string) =>
    fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : ''
  const configs = [
    path.join(commonDir, 'config'),
    path.join(os.homedir(), '.gitconfig'),
    path.join(os.homedir(), '.config/git/config')
  ]
  if (configs.some(file => conversion.test(read(file)))) return true
  const attributeFiles = [path.join(commonDir, 'info/attributes')]
  for (let current = dir; ; current = path.dirname(current)) {
    attributeFiles.push(path.join(current, '.gitattributes'))
    if (current === workTree || current === path.dirname(current)) break
  }
  return attributeFiles.some(file =>
    read(file)
      .split('\n')
      .some(line => !line.trimStart().startsWith('#') && attributes.test(line))
  )
}
