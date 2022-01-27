import {createId, future, Schema} from '@alinea/core'
import {outcome} from '@alinea/core/Outcome'
import git, {AuthCallback, HttpClient, PromiseFsClient} from 'isomorphic-git'
import {posix as path} from 'path'
import * as Y from 'yjs'
import {FS} from './FS'

export interface Drafts {
  get(id: string, stateVector?: Uint8Array): Promise<Uint8Array | undefined>
  update(id: string, update: Uint8Array): Promise<void>
  delete(ids: Array<string>): Promise<void>
  updates(): AsyncGenerator<{id: string; update: Uint8Array}>
}

export type FileDraftsOptions = {
  schema: Schema
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

  async update(id: string, update: Uint8Array): Promise<void> {
    const updateId = createId()
    return this.applyUpdate(id, update, updateId)
  }

  async delete(ids: Array<string>): Promise<void> {
    const {fs, dir} = this.options
    for (const id of ids) {
      const location = path.join(dir, id)
      await fs.rm(location, {recursive: true, force: true})
    }
  }

  async *updates(): AsyncGenerator<{id: string; update: Uint8Array}> {
    const {fs, dir, schema} = this.options
    const [directories = []] = await future(fs.readdir(dir))
    for (const dir of directories) {
      if (dir.startsWith('.')) continue
      const [update, err] = await future(this.get(dir))
      if (update) yield {id: dir, update}
    }
  }
}

export type GitDraftsOptions = FileDraftsOptions & {
  http: HttpClient
  onAuth: AuthCallback
  url: string
  branch: string
  author: {
    name: string
    email: string
  }
}

export class GitDrafts extends FileDrafts {
  fs: PromiseFsClient
  lastUpdate: Date | undefined
  initialized: Promise<void> | undefined
  syncRate = 60

  constructor(protected options: GitDraftsOptions) {
    super(options)
    this.fs = {promises: options.fs}
  }

  async initialize() {
    const {fs, dir, url} = this.options
    const isGit = await outcome.succeeds(fs.stat(path.join(dir, '.git')))
    if (!isGit) {
      const res = await outcome(
        git.clone({
          ...this.options,
          fs: this.fs,
          depth: 1,
          singleBranch: true
        })
      )
      if (res.isFailure()) {
        console.warn(res.error)
        await git.init({fs: this.fs, dir})
        await git.addRemote({fs: this.fs, dir, remote: 'origin', url})
        await git.branch({
          fs: this.fs,
          dir,
          ref: this.options.branch,
          checkout: true
        })
      }
      this.lastUpdate = new Date()
    }
  }

  sync() {
    console.log('syncing')
    return git.pull({...this.options, fs: this.fs})
  }

  init() {
    if (
      this.lastUpdate &&
      this.lastUpdate.getTime() + 1000 * this.syncRate < Date.now()
    ) {
      this.lastUpdate = new Date()
      return (this.initialized = this.sync())
    }
    return this.initialized || (this.initialized = this.initialize())
  }

  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Uint8Array | undefined> {
    await this.init()
    return super.get(id, stateVector)
  }

  async update(id: string, update: Uint8Array): Promise<void> {
    const {dir, author} = this.options
    await this.init()
    const updateId = createId()
    await super.applyUpdate(id, update, updateId)
    const filepath = path.join(id, updateId)
    await git.add({
      fs: this.fs,
      dir,
      filepath
    })
    await git.commit({
      fs: this.fs,
      dir,
      author,
      message: `update: ${id} (${updateId})`
    })
    try {
      await git.push({
        ...this.options,
        fs: this.fs,
        remoteRef: this.options.branch
      })
    } catch (e) {
      await this.sync()
      await git.push({
        ...this.options,
        fs: this.fs,
        remoteRef: this.options.branch
      })
    }
  }

  async delete(ids: Array<string>): Promise<void> {
    const {dir} = this.options
    await this.init()
    await super.delete(ids)
    const added = new Set()
    for (const id of ids) {
      try {
        await git.add({fs: this.fs, dir, filepath: id})
        added.add(id)
      } catch (e) {}
    }
    if (added.size === 0) return
    await git.commit({
      fs: this.fs,
      dir,
      author: this.options.author,
      message: `discard: ${[...added].join(', ')}`
    })
    await git.push({...this.options, fs: this.fs})
  }

  async *updates() {
    await this.init()
    for await (const update of super.updates()) {
      yield update
    }
  }
}
