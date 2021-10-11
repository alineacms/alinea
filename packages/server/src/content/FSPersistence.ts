import {Entry, Outcome} from '@alinea/core'
import {ContentIndex} from '@alinea/index'
import fs from 'fs-extra'
import pLimit from 'p-limit'
import path from 'path'
import {Persistence} from '../Persistence'
import {fileChanges} from './FileChanges'

export class FSPersistence implements Persistence {
  constructor(protected index: ContentIndex, protected dir: string) {}

  async publish(entries: Array<Entry>) {
    const limit = pLimit(4)
    return Outcome.promised(async () => {
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
