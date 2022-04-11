import {createId, outcome} from '@alinea/core'
import git, {AuthCallback, HttpClient, PromiseFsClient} from 'isomorphic-git'
import {posix as path} from 'path'
import {Drafts} from '../Drafts'
import {FileDrafts, FileDraftsOptions} from './FileDrafts'

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
          ref: this.options.branch,
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
    return git.pull({...this.options, ref: this.options.branch, fs: this.fs})
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

  async update(id: string, update: Uint8Array): Promise<Drafts.Update> {
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
        ref: this.options.branch,
        remoteRef: this.options.branch
      })
    } catch (e) {
      await this.sync()
      await git.push({
        ...this.options,
        fs: this.fs,
        ref: this.options.branch,
        remoteRef: this.options.branch
      })
    }
    return {id, update: (await this.get(id))!}
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
    await git.push({...this.options, ref: this.options.branch, fs: this.fs})
  }

  async *updates() {
    await this.init()
    for await (const update of super.updates()) {
      yield update
    }
  }
}
