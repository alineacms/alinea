import {JsonLoader} from 'alinea/backend'
import {EntryFile, History, Revision} from 'alinea/backend/History'
import {Config, Workspace} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {join, normalize, relative} from 'alinea/core/util/Paths'
import simpleGit, {SimpleGit} from 'simple-git'

const encoder = new TextEncoder()

export class GitHistory implements History {
  git: SimpleGit

  constructor(public config: Config, public rootDir: string) {
    this.git = simpleGit(rootDir)
  }

  async revisions(file: EntryFile): Promise<Array<Revision>> {
    const {config} = this
    const contentDir = Workspace.data(config.workspaces[file.workspace]).source
    const location = join(contentDir, file.root, file.filePath)
    const list = await this.git.log([
      // If we follow we can't really retrieve the data later on because
      // the file path will be wrong
      /*'--follow',*/
      '--',
      location
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

  async revisionData(
    file: EntryFile,
    revisionId: string
  ): Promise<EntryRecord> {
    const {config} = this
    const contentDir = Workspace.data(config.workspaces[file.workspace]).source
    const topLevel = (
      await this.git.raw(['rev-parse', '--show-toplevel'])
    ).trim()
    const location = relative(
      normalize(topLevel),
      join(this.rootDir, contentDir, file.root, file.filePath)
    )
    const data = await this.git.show([
      `${revisionId}:${location}`,
      '--format=%B'
    ])
    try {
      return JsonLoader.parse(config.schema, encoder.encode(data))
    } catch (cause) {
      throw new Error(
        `Failed to parse revision ${revisionId} of ${file.filePath}`,
        {cause}
      )
    }
  }
}
