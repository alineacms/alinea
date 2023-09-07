import {History, Revision} from 'alinea/backend/History'
import {EntryRecord} from 'alinea/core/EntryRecord'
import simpleGit, {SimpleGit} from 'simple-git'

export class GitHistory implements History {
  git: SimpleGit

  constructor(rootDir: string) {
    this.git = simpleGit(rootDir)
  }

  async revisions(filePath: string): Promise<Array<Revision>> {
    const list = await this.git.log([
      '--follow',
      '--format={"hash":"%H","date":"%aI","body":"%B"}',
      '--',
      filePath
    ])
    return list.all.map(row => {
      return {
        revisionId: row.hash,
        createdAt: new Date(row.date).getTime(),
        description: row.body
      }
    })
  }

  async revisionData(revisionId: string): Promise<EntryRecord> {
    const data = await this.git.show([revisionId, '--format=%B'])
    return JSON.parse(data)
  }
}
