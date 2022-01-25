import {createId} from '@alinea/core'
import {Outcome, outcome} from '@alinea/core/Outcome'
import git, {AuthCallback, HttpClient, PromiseFsClient} from 'isomorphic-git'
import path from 'path/posix'
import * as Y from 'yjs'
import {FS} from './FS'

export interface Drafts {
  get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Outcome<Uint8Array | undefined>>
  update(id: string, update: Uint8Array): Promise<void>
  delete(id: string): Promise<void>
}

export type FileDraftsOptions = {
  fs: FS
  dir: string
}

export class FileDrafts implements Drafts {
  constructor(protected options: FileDraftsOptions) {}

  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Outcome<Uint8Array | undefined>> {
    return outcome(async () => {
      const {fs, dir} = this.options
      const location = path.join(dir, id)
      const updates = await outcome(fs.readdir(location))
      if (!updates.isSuccess()) return undefined
      const doc = new Y.Doc()
      for (const file of updates.value) {
        const update = await outcome(fs.readFile(path.join(location, file)))
        if (update.isSuccess()) Y.applyUpdate(doc, update.value)
      }
      return Y.encodeStateAsUpdate(doc, stateVector)
    })
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

  async delete(id: string): Promise<void> {
    const {fs, dir} = this.options
    const location = path.join(dir, id)
    await fs.rmdir(location, {recursive: true})
  }
}

export type GitDraftsOptions = FileDraftsOptions & {
  http: HttpClient
  onAuth: AuthCallback
  url: string
  ref: string
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
        await git.init({fs: this.fs, dir})
        await git.addRemote({fs: this.fs, dir, remote: 'origin', url})
        await git.branch({
          fs: this.fs,
          dir,
          ref: this.options.ref,
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
  ): Promise<Outcome<Uint8Array | undefined>> {
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
    await git.push({
      ...this.options,
      fs: this.fs,
      remoteRef: this.options.ref
    })
  }

  async delete(id: string): Promise<void> {
    const {dir} = this.options
    await this.init()
    await super.delete(id)
    await git.add({
      fs: this.fs,
      dir,
      filepath: id
    })
    await git.commit({
      fs: this.fs,
      dir,
      author: this.options.author,
      message: `discard: ${id}`
    })
    await git.push({...this.options, fs: this.fs})
  }
}
