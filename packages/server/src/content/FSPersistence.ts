import {Entry, outcome} from '@alinea/core'
import pLimit from 'p-limit'
import path from 'path'
import {Persistence} from '../Persistence'
import {Cache} from './cache/Cache'
import {fileChanges} from './FileChanges'
import {FS} from './FS'

const limit = pLimit(4)

export class FSPersistence implements Persistence {
  constructor(
    protected fs: FS,
    protected index: Cache,
    protected dir: string
  ) {}

  async persist(entries: Array<Entry>) {
    return outcome(async () => {
      const store = await this.index.store
      const {contentChanges, fileRemoves} = fileChanges(store, entries)
      const tasks = fileRemoves
        .map(file => {
          return () => this.fs.unlink(path.join(this.dir, file))
        })
        .concat(
          contentChanges.map(([file, contents]) => {
            return () => this.fs.writeFile(path.join(this.dir, file), contents)
          })
        )
        .map(limit)
      return Promise.all(tasks).then(() => void 0)
    })
  }
}
