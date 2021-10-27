import {Cache} from '@alinea/cache'
import {Entry, outcome} from '@alinea/core'
import fs from 'fs-extra'
import pLimit from 'p-limit'
import path from 'path'
import {Persistence} from '../Persistence'
import {fileChanges} from './FileChanges'

const limit = pLimit(4)

export class FSPersistence implements Persistence {
  constructor(protected index: Cache, protected dir: string) {}

  async publish(entries: Array<Entry>) {
    return outcome(async () => {
      const store = await this.index.store
      const {contentChanges, fileRemoves} = fileChanges(store, entries)
      const tasks = fileRemoves
        .map(file => {
          return () => fs.unlink(path.join(this.dir, file))
        })
        .concat(
          contentChanges.map(([file, contents]) => {
            return () => fs.writeFile(path.join(this.dir, file), contents)
          })
        )
        .map(limit)
      return Promise.all(tasks).then(() => void 0)
    })
  }
}
