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
        'log',
        '--follow',
        '--name-status',
        '--pretty=format:%H%n%at%n%s%n%ae%n%an%n%f',
        '--',
        versioned
      ])
      const revisions = output
        .split('\n\n')
        .filter(entry => {
          return entry.includes('\n')
        })
        .map(entry => {
          const [ref, timestamp, message, email, name, changedFile, ...rest] =
            entry.split('\n')
          const fileLocation = rest.length
            ? rest[rest.length - 1].split('\t').pop()!.trim()
            : versioned
          const user = parseCoAuthoredBy(message) ?? {name, email}
          return {
            ref,
            createdAt: Number.parseInt(timestamp) * 1000,
            description: message,
            file: fileLocation,
            user
          }
        })
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
