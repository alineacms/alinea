import {createId, future} from '@alinea/core'
import {posix as path} from 'path'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'
import {FS} from '../FS'

export type FileDraftsOptions = {
  fs: FS
  dir: string
}

export class FileDrafts implements Drafts {
  constructor(protected options: FileDraftsOptions) {}

  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Uint8Array | undefined> {
    const {fs, dir} = this.options
    const location = path.join(dir, id)
    const [files] = await future(fs.readdir(location))
    if (!files) return undefined
    files.sort((a, b) => a.localeCompare(b))
    const doc = new Y.Doc()
    for (const file of files) {
      const update = await future(fs.readFile(path.join(location, file)))
      try {
        if (update.isSuccess()) Y.applyUpdate(doc, update.value)
      } catch (e) {
        // I ran into "Integer out of range!" which shouldn't happen
        // Todo: find out why we ended up with an invalid update
      }
    }
    return Y.encodeStateAsUpdate(doc, stateVector)
  }

  async applyUpdate(
    id: string,
    update: Uint8Array,
    updateId: string
  ): Promise<void> {
    const {fs, dir} = this.options
    const filepath = path.join(id, updateId)
    const location = path.join(dir, filepath)
    await fs.mkdir(path.join(dir, id), {recursive: true})
    await fs.writeFile(location, update)
  }

  async update(id: string, update: Uint8Array): Promise<Drafts.Update> {
    const updateId = createId()
    this.applyUpdate(id, update, updateId)
    return {id, update: (await this.get(id))!}
  }

  async delete(ids: Array<string>): Promise<void> {
    const {fs, dir} = this.options
    for (const id of ids) {
      const location = path.join(dir, id)
      await fs.rm(location, {recursive: true, force: true})
    }
  }

  async *updates(): AsyncGenerator<{id: string; update: Uint8Array}> {
    const {fs, dir} = this.options
    const [directories = []] = await future(fs.readdir(dir))
    for (const dir of directories) {
      if (dir.startsWith('.')) continue
      const [update, err] = await future(this.get(dir))
      if (update) yield {id: dir, update}
    }
  }
}
