import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {execGit} from 'alinea/backend/util/ExecGit'
import type {Config} from 'alinea/core/Config'
import type {Revision} from 'alinea/core/Connection'
import type {HistoryApi} from 'alinea/core/Connection'
import type {EntryRecord} from 'alinea/core/EntryRecord'

const encoder = new TextEncoder()

export class GitHistory implements HistoryApi {
  constructor(
    public config: Config,
    public rootDir: string
  ) {}

  async revisions(file: string): Promise<Array<Revision>> {
    const output = await execGit(this.rootDir, [
      'log',
      '--follow',
      '--name-status',
      '--pretty=format:%H%n%at%n%s%n%ae%n%an%n%f',
      '--',
      file
    ])

    const revisions = output.split('\n\n').map(entry => {
      const [hash, timestamp, message, email, name, changedFile, ...rest] =
        entry.split('\n')
      const fileLocation = rest.length
        ? rest[rest.length - 1].split('\t').pop()!.trim()
        : file

      return {
        ref: hash,
        createdAt: Number.parseInt(timestamp) * 1000,
        description: message,
        file: fileLocation,
        user: {
          sub: email,
          name: name
        }
      }
    })

    return revisions
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
