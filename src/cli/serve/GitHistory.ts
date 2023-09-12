import {JsonLoader} from 'alinea/backend'
import {History, Revision} from 'alinea/backend/History'
import {Config} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {join, normalize, relative} from 'alinea/core/util/Paths'
import simpleGit, {SimpleGit} from 'simple-git'

const encoder = new TextEncoder()

export class GitHistory implements History {
  git: SimpleGit

  constructor(public config: Config, public rootDir: string) {
    this.git = simpleGit(rootDir)
  }

  async revisions(file: string): Promise<Array<Revision>> {
    const list = await this.git.log([
      // If we follow we can't really retrieve the data later on because
      // the file path will be wrong
      /*'--follow',*/
      '--',
      join(this.rootDir, file)
    ])
    return list.all.map(row => {
      return {
        revisionId: row.hash,
        createdAt: new Date(row.date).getTime(),
        description: row.message,
        user: {
          sub: row.author_email,
          name: row.author_name
        }
      }
    })
  }

  async revisionData(file: string, revisionId: string): Promise<EntryRecord> {
    const {config} = this
    const topLevel = (
      await this.git.raw(['rev-parse', '--show-toplevel'])
    ).trim()
    const location = relative(normalize(topLevel), join(this.rootDir, file))
    const data = await this.git.show([
      `${revisionId}:${location}`,
      '--format=%B'
    ])
    try {
      return JsonLoader.parse(config.schema, encoder.encode(data))
    } catch (cause) {
      throw new Error(`Failed to parse revision ${revisionId} of ${file}`, {
        cause
      })
    }
  }
}
