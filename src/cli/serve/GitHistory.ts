import fs from 'node:fs'
import path from 'node:path'
import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Config} from '#/core/Config.js'
import type {HistoryApi, Revision} from '#/core/Connection.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {identifyEntry} from '#/core/graft/IdentifyEntry.js'
import {fileVersions} from '#/core/util/EntryFilenames.js'
import {readCommit, readFile, revisions} from '@alinea/graft'
import {type GitRepository, gitRepository} from '@alinea/graft/fs'
import {parseCoAuthoredBy} from '../util/CommitMessage.js'

/**
 * History of entries read from the project's `.git`, without running git.
 * An entry moved and edited in one commit is followed by its id.
 */
export class GitHistory implements HistoryApi {
  #root: string
  #workTree: string | undefined

  constructor(
    public config: Config,
    public rootDir: string
  ) {
    this.#root = fs.realpathSync(path.resolve(rootDir))
    this.#workTree = workTreeOf(this.#root)
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return this.#open(async (git, prefix) => {
      const head = await headOf(git)
      if (!head) return []
      const identify = identifyEntry(this.config, {
        contentDir: prefix + Config.contentDir(this.config)
      })
      const result = new Map<string, Revision>()
      for (const version of fileVersions(file)) {
        const walk = revisions(git.objects, head, prefix + version, {identify})
        for await (const revision of walk) {
          if (!revision.entry || result.has(revision.sha)) continue
          const {commit} = revision
          const subject = commit.message.split('\n')[0]
          result.set(revision.sha, {
            ref: revision.sha,
            createdAt: commit.author.timestamp * 1000,
            description: subject,
            file: revision.path.slice(prefix.length),
            user: parseCoAuthoredBy(commit.message) ?? {
              name: commit.author.name,
              email: commit.author.email
            }
          })
        }
      }
      return [...result.values()].sort((a, b) => b.createdAt - a.createdAt)
    })
  }

  async revisionData(file: string, ref: string): Promise<EntryRecord> {
    return this.#open(async (git, prefix) => {
      const {tree} = await readCommit(git.objects, ref)
      const contents = await readFile(git.objects, tree, prefix + file)
      if (!contents) throw new Error(`No revision ${ref} of ${file}`)
      try {
        return JsonLoader.parse(this.config.schema, contents)
      } catch (cause) {
        throw new Error(`Failed to parse revision ${ref} of ${file}`, {
          cause
        })
      }
    })
  }

  /** Opens the repository for one call, with the project's path in it */
  async #open<T>(
    run: (git: GitRepository, prefix: string) => Promise<T>
  ): Promise<T> {
    if (!this.#workTree) throw new Error(`No git repository at ${this.rootDir}`)
    const git = gitRepository(this.#workTree)
    try {
      const dir = path
        .relative(this.#workTree, this.#root)
        .replaceAll('\\', '/')
      return await run(git, dir ? `${dir}/` : '')
    } finally {
      git.close()
    }
  }
}

/** The branch HEAD is on, or the commit it names when detached */
async function headOf(git: GitRepository): Promise<string | undefined> {
  const branch = await git.refs.symbolic('HEAD')
  return git.refs.get(branch ?? 'HEAD')
}

/** The directory holding `.git`, at or above the project's root */
function workTreeOf(dir: string): string | undefined {
  let current = dir
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}
