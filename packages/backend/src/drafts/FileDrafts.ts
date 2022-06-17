import {future, Hub, outcome} from '@alinea/core'
import {posix as path} from 'node:path'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'
import {FS} from '../FS'

export type FileDraftsOptions = {
  fs: FS
  dir: string
}

export class FileDrafts implements Drafts {
  constructor(protected options: FileDraftsOptions) {}

  async get({
    id,
    stateVector
  }: Hub.EntryParams): Promise<Uint8Array | undefined> {
    const {fs, dir} = this.options
    const location = path.join(dir, id)
    const [draft, err] = await outcome(fs.readFile(location))
    if (!(draft instanceof Uint8Array)) return undefined
    if (!stateVector) return draft
    const doc = new Y.Doc()
    Y.applyUpdate(doc, draft)
    return Y.encodeStateAsUpdate(doc, stateVector)
  }

  async update({id, update}: Hub.UpdateParams): Promise<Drafts.Update> {
    const {fs, dir} = this.options
    const doc = new Y.Doc()
    const current = await this.get({id})
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const draft = Buffer.from(Y.encodeStateAsUpdate(doc))
    const location = path.join(dir, id)
    await outcome(fs.mkdir(dir, {recursive: true}))
    await fs.writeFile(location, draft)
    return {id, update: draft}
  }

  async delete({ids}: Hub.DeleteMultipleParams): Promise<void> {
    const {fs, dir} = this.options
    for (const id of ids) {
      const location = path.join(dir, id)
      await fs.rm(location, {force: true})
    }
  }

  async *updates(): AsyncGenerator<{id: string; update: Uint8Array}> {
    const {fs, dir} = this.options
    const [files = []] = await future(fs.readdir(dir))
    for (const file of files) {
      if (file.startsWith('.')) continue
      const [update, err] = await future(this.get({id: file}))
      if (update) yield {id: file, update}
    }
  }
}
