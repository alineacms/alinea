import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {execGit} from '#/backend/util/ExecGit.js'
import type {Config} from '#/core/Config.js'
import type {HistoryApi, Revision} from '#/core/Connection.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {fileVersions} from '#/core/util/EntryFilenames.js'
import {parseCoAuthoredBy} from '../util/CommitMessage.js'

const encoder = new TextEncoder()

export class GitHistory implements HistoryApi {
  constructor(
    public config: Config,
    public rootDir: string
  ) {}

  async revisions(file: string): Promise<Array<Revision>> {
    const versions = fileVersions(file)
    const results = Array<Revision>()
    for (const versioned of versions) {
      const output = await execGit(this.rootDir, [
        '-c',
        'core.quotePath=false',
        'log',
        '--follow',
        '--name-status',
        // Each commit starts with a record separator: a subject can be empty,
        // so blank lines do not separate commits
        '--pretty=format:%x1e%H%n%at%n%s%n%ae%n%an',
        '--',
        versioned
      ])
      const revisions = Array<Revision>()
      for (const entry of output.split('\x1e')) {
        const [ref, timestamp, message, email, name, ...rest] =
          entry.split('\n')
        if (!ref || !timestamp) continue
        const [status, ...paths] =
          rest
            .filter(line => line.trim())
            .at(-1)
            ?.split('\t') ?? []
        // The commit that deleted the file, such as a publish removing the
        // draft, has no version of it to show
        if (status === 'D') continue
        revisions.push({
          ref,
          createdAt: Number.parseInt(timestamp) * 1000,
          description: message,
          file: paths.at(-1)?.trim() || versioned,
          user: parseCoAuthoredBy(message) ?? {name, email}
        })
      }
      results.push(...revisions)
    }

    // de-duplicate revisions by ref
    const uniqueRevisions = new Map<string, Revision>()
    for (const revision of results) {
      const existing = uniqueRevisions.get(revision.ref)
      if (!existing) uniqueRevisions.set(revision.ref, revision)
    }
    return [...uniqueRevisions.values()].sort(
      (a, b) => b.createdAt - a.createdAt
    )
  }

  async revisionData(file: string, ref: string): Promise<EntryRecord> {
    const {config} = this
    const data = await execGit(this.rootDir, [
      '-c',
      'core.quotePath=false',
      'show',
      `${ref}:${file}`,
      '--format=%B'
    ])
    try {
      return JsonLoader.parse(config.schema, encoder.encode(data))
    } catch (cause) {
      throw new Error(`Failed to parse revision ${ref} of ${file}`, {
        cause
      })
    }
  }
}
