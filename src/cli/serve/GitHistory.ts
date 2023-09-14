import {JsonLoader} from 'alinea/backend'
import {History, Revision} from 'alinea/backend/History'
import {Config} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {join} from 'alinea/core/util/Paths'
import simpleGit, {SimpleGit} from 'simple-git'

const encoder = new TextEncoder()

export class GitHistory implements History {
  git: SimpleGit

  constructor(public config: Config, public rootDir: string) {
    this.git = simpleGit(rootDir)
  }

  async revisions(file: string): Promise<Array<Revision>> {
    const list = await this.git.log([
      '--follow',
      '--name-status',
      '--',
      join(this.rootDir, file)
    ])
    return list.all.map(row => {
      return {
        ref: row.hash,
        createdAt: new Date(row.date).getTime(),
        description: row.message,
        file: row.diff?.files?.[0]?.file ?? file,
        user: {
          sub: row.author_email,
          name: row.author_name
        }
      }
    })
  }

  async revisionData(file: string, ref: string): Promise<EntryRecord> {
    const {config} = this
    const data = await this.git.show([`${ref}:${file}`, '--format=%B'])
    try {
      return JsonLoader.parse(config.schema, encoder.encode(data))
    } catch (cause) {
      throw new Error(`Failed to parse revision ${ref} of ${file}`, {
        cause
      })
    }
  }
}
