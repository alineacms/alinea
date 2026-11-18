import {
  type Change,
  commit,
  gitServer,
  type Handler,
  confirm,
  connect,
  emptyTree,
  entryAt,
  Mode,
  parseTrailers,
  type Person,
  readCommit,
  readFile,
  readTrees,
  replicate,
  type ReplicaEndpoint,
  type ReplicaStatus,
  type Repository,
  revisions,
  save,
  StrictError,
  type TreeEntry,
  type TreeMergeOptions,
  webhook,
  withTrailers
} from '@alinea/graft'
import {Config} from '#/core/Config.js'
import type {
  CommitApi,
  HistoryApi,
  Revision,
  SyncApi
} from '#/core/Connection.js'
import type {CommitChange, CommitRequest} from '#/core/db/CommitRequest.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {identifyEntry} from '#/core/graft/IdentifyEntry.js'
import {mergeEntryFiles} from '#/core/graft/MergeEntryFiles.js'
import {repairEntries} from '#/core/graft/RepairEntries.js'
import {HttpError} from '#/core/HttpError.js'
import {ReadonlyTree, type Entry as TreeNode} from '#/core/source/Tree.js'
import {fileVersions} from '#/core/util/EntryFilenames.js'
import * as paths from '#/core/util/Paths.js'

/** The roots of the canonical tree: entries, and uploaded media files */
export const contentRoot = 'content'
export const mediaRoot = 'media'

export interface GraftApiOptions {
  repo: Repository
  config: Config
  /** The ref holding the content, `refs/heads/main` by default */
  ref?: string
  /** Git repositories the content replicates to */
  replicas?: ReadonlyArray<ReplicaEndpoint>
  /** Who commits, when a save has no user; alinea by default */
  committer?: {name: string; email: string}
  /**
   * The secret of the push webhook, `?action=replicate&secret=`, 16
   * characters at least. Without it there is no webhook.
   */
  webhookSecret?: string
}

/** Who may use a git route: a response refuses the request */
export type GraftAuthorize = (request: Request) => Promise<Response | undefined>

/**
 * Content kept in a graft repository: saves are commits, merged with what
 * was saved meanwhile when made from an older state, history is the commits,
 * and replicas are git repositories on any host.
 */
export class GraftApi implements CommitApi, SyncApi, HistoryApi {
  #repo: Repository
  #config: Config
  #ref: string
  #replicas: ReadonlyArray<ReplicaEndpoint>
  #committer: {name: string; email: string}
  #merge: Omit<TreeMergeOptions, 'prefer'>
  #webhookSecret: string | undefined
  #webhook: Handler | undefined
  #git: Handler | undefined
  #authorizers = new WeakMap<Request, GraftAuthorize>()

  constructor(options: GraftApiOptions) {
    this.#repo = options.repo
    this.#config = options.config
    this.#ref = options.ref ?? 'refs/heads/main'
    this.#replicas = options.replicas ?? []
    this.#webhookSecret = options.webhookSecret
    this.#committer = options.committer ?? {
      name: 'Alinea',
      email: 'noreply@alineacms.com'
    }
    // Paths of the canonical tree start at its content root
    const entries = {contentDir: contentRoot}
    this.#merge = {
      mergeFile: mergeEntryFiles(this.#config, entries),
      identify: identifyEntry(this.#config, entries),
      repair: repairEntries(this.#config, entries)
    }
  }

  get repo(): Repository {
    return this.#repo
  }

  get ref(): string {
    return this.#ref
  }

  /**
   * Imports the content once when the repository has none: from a two-way
   * replica when there is one and it holds content, else from `build`, the
   * content deployed with the build. A missing ref is never empty content. Of several servers
   * starting at once one seeds, by a compare-and-swap on the ref.
   */
  async seed(build: SyncApi): Promise<void> {
    if ((await this.#repo.refs.get(this.#ref)) !== undefined) return
    const twoWay = this.#replicas.find(
      ({replica}) => replica.direction === 'two-way'
    )
    if (twoWay)
      await connect(this.#repo, {
        ...this.#passOptions(),
        ...twoWay,
        mode: 'import'
      }).catch(error => {
        if (!/holds content/.test(String(error))) throw error
      })
    const head = await this.#repo.refs.get(this.#ref)
    // A replica without content yet gets the build's on its next pass
    if (head && (await this.#contentTree(head)) !== emptyTree) return
    const tree = await build.getTreeIfDifferent(emptyTree)
    if (!tree) return
    const files = tree
      .flat()
      .tree.filter(entry => entry.type === 'blob')
      .map(entry => ({path: entry.path, sha: entry.sha}))
    const blobs = new Map<string, Uint8Array>()
    for await (const [sha, blob] of build.getBlobs(files.map(f => f.sha)))
      blobs.set(sha, blob)
    const changes: Array<Change> = files.map(({path, sha}) => ({
      op: 'put',
      path: `${contentRoot}/${path}`,
      contents: blobs.get(sha)!
    }))
    const person = this.#person()
    const input = {
      changes,
      author: person,
      committer: person,
      message: 'Import content\n'
    }
    if (head)
      await save(
        this.#repo,
        this.#ref,
        {...input, base: head},
        {...this.#merge, prefer: 'ours'}
      )
    else await commit(this.#repo, this.#ref, {...input, parents: []})
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const head = await this.#repo.refs.get(this.#ref)
    const root = head ? await this.#contentTree(head) : emptyTree
    if (root === sha) return undefined
    return this.#readTree(root)
  }

  async *getBlobs(
    shas: ReadonlyArray<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const found = await this.#repo.objects.get(shas)
    for (const sha of shas) {
      const object = found.get(sha)
      if (object?.type === 'blob') yield [sha, object.data]
    }
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const base = await this.#commitWithContent(request.fromSha)
    const changes = await Promise.all(
      request.changes.map(change => this.#change(change))
    )
    const author = this.#person(request.user)
    const committer = this.#person()
    const trailers =
      request.user?.name && request.user.email
        ? [
            {
              key: 'Co-authored-by',
              value: `${request.user.name} <${request.user.email}>`
            }
          ]
        : []
    const saved = await save(
      this.#repo,
      this.#ref,
      {
        base,
        changes,
        author,
        committer,
        message: withTrailers(request.description, trailers)
      },
      {...this.#merge, prefer: 'ours'}
    )
    if (this.#replicas.some(({replica}) => replica.strict))
      await confirm(this.#repo, this.#passOptions(), saved.sha).catch(error => {
        // The save stands; later passes bring it to the replicas
        if (!(error instanceof StrictError)) throw error
        console.warn(`Alinea: ${error.message}`)
      })
    return {sha: await this.#contentTree(saved.sha)}
  }

  /** Answers a push webhook by passing the replicas right away */
  webhook(request: Request): Promise<Response> {
    if (!this.#webhookSecret)
      return Promise.resolve(new Response('Not found', {status: 404}))
    this.#webhook ??= webhook(this.#repo, {
      ...this.#passOptions(),
      secret: this.#webhookSecret
    })
    return this.#webhook(request)
  }

  /**
   * Serves the repository over git's smart HTTP below `<handler>/git`, to
   * whoever `authorize` lets in. Its handler is made once, as git servers
   * count what they hold per handler.
   */
  serveGit(request: Request, authorize: GraftAuthorize): Promise<Response> {
    this.#authorizers.set(request, authorize)
    this.#git ??= gitServer({
      repo: this.#repo,
      head: this.#ref,
      authorize: async request => {
        const check = this.#authorizers.get(request)
        if (!check) return new Response('Unauthorized', {status: 401})
        return check(request)
      }
    })
    return this.#git(request)
  }

  /** A replication pass for replicas not passed in the last `interval` ms */
  replicate(interval?: number): Promise<Array<ReplicaStatus>> {
    if (this.#replicas.length === 0) return Promise.resolve([])
    return replicate(this.#repo, {...this.#passOptions(), interval})
  }

  async revisions(file: string): Promise<Array<Revision>> {
    const head = await this.#repo.refs.get(this.#ref)
    if (!head) return []
    const contentDir = Config.contentDir(this.#config)
    const result = new Map<string, Revision>()
    for (const version of fileVersions(file)) {
      const path = this.#canonicalPath(version)
      if (!path) continue
      for await (const revision of revisions(this.#repo.objects, head, path, {
        identify: this.#merge.identify
      })) {
        if (!revision.entry || result.has(revision.sha)) continue
        const {commit} = revision
        const coAuthor = parseTrailers(commit.message).trailers.find(
          trailer => trailer.key.toLowerCase() === 'co-authored-by'
        )
        const named = coAuthor && /^(.*?)\s*<([^>]+)>$/.exec(coAuthor.value)
        result.set(revision.sha, {
          ref: revision.sha,
          createdAt: commit.committer.timestamp * 1000,
          file: paths.join(
            contentDir,
            revision.path.slice(contentRoot.length + 1)
          ),
          user: named
            ? {name: named[1], email: named[2]}
            : {name: commit.author.name, email: commit.author.email},
          description: commit.message
        })
        if (result.size >= 100) break
      }
    }
    return [...result.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const path = this.#canonicalPath(file)
    if (!path) return undefined
    try {
      const {tree} = await readCommit(this.#repo.objects, revisionId)
      const contents = await readFile(this.#repo.objects, tree, path)
      return contents && JSON.parse(new TextDecoder().decode(contents))
    } catch {
      return undefined
    }
  }

  #passOptions() {
    return {
      ref: this.#ref,
      replicas: this.#replicas,
      committer: this.#person(),
      merge: this.#merge
    }
  }

  /** A path from the project's root as the canonical tree holds it */
  #canonicalPath(file: string): string | undefined {
    const contentDir = Config.contentDir(this.#config)
    const relative = paths.relative(contentDir, file)
    if (relative.startsWith('..')) return undefined
    return `${contentRoot}/${relative}`
  }

  async #change(change: CommitChange): Promise<Change> {
    switch (change.op) {
      case 'addContent':
        return {
          op: 'put',
          path: `${contentRoot}/${change.path}`,
          contents: new TextEncoder().encode(change.contents)
        }
      case 'deleteContent':
        return {op: 'remove', path: `${contentRoot}/${change.path}`}
      case 'uploadFile': {
        const response = await fetch(change.url)
        if (!response.ok)
          throw new HttpError(response.status, await response.text())
        return {
          op: 'put',
          path: `${mediaRoot}/${this.#mediaPath(change.location)}`,
          contents: new Uint8Array(await response.arrayBuffer())
        }
      }
      case 'removeFile':
        return {
          op: 'remove',
          path: `${mediaRoot}/${this.#mediaPath(change.location)}`
        }
    }
  }

  /** An upload's location from the project's root, below the media root */
  #mediaPath(location: string): string {
    const mediaDir = Config.mainWorkspace(this.#config).mediaDir
    const relative = mediaDir ? paths.relative(mediaDir, location) : location
    return relative.startsWith('..') ? location : relative
  }

  #person(user?: {name?: string; email?: string} | null): Person {
    const name = user?.name || this.#committer.name
    const email = user?.email || this.#committer.email
    return {
      name,
      email,
      timestamp: Math.floor(Date.now() / 1000),
      timezone: '+0000'
    }
  }

  async #contentTree(commitSha: string): Promise<string> {
    const {tree} = await readCommit(this.#repo.objects, commitSha)
    const entry = await entryAt(this.#repo.objects, tree, contentRoot)
    return entry?.sha ?? emptyTree
  }

  /**
   * The commit a save was made from, named by its content tree: the latest
   * commit holding that content, from the head back. When none does, as
   * for an index older than the history kept, the head: the save applies
   * onto it as saves did before they merged.
   */
  async #commitWithContent(sha: string): Promise<string | undefined> {
    let current = await this.#repo.refs.get(this.#ref)
    for (let depth = 0; current && depth < 256; depth++) {
      if ((await this.#contentTree(current)) === sha) return current
      current = (await readCommit(this.#repo.objects, current)).parents[0]
    }
    return this.#repo.refs.get(this.#ref)
  }

  /** The content tree in alinea's form, read a level at a time */
  async #readTree(root: string): Promise<ReadonlyTree> {
    const trees = new Map<string, Array<TreeEntry>>()
    let level = [root]
    while (level.length > 0) {
      const read = await readTrees(this.#repo.objects, level)
      for (const [sha, entries] of read) trees.set(sha, entries)
      level = [...read.values()]
        .flat()
        .filter(entry => entry.mode === Mode.tree && !trees.has(entry.sha))
        .map(entry => entry.sha)
    }
    const build = (sha: string): Array<TreeNode> =>
      trees
        .get(sha)!
        .filter(
          entry =>
            entry.mode === Mode.tree ||
            entry.mode === Mode.file ||
            entry.mode === Mode.executable
        )
        .map(entry =>
          entry.mode === Mode.tree
            ? {
                name: entry.name,
                mode: '040000',
                sha: entry.sha,
                entries: build(entry.sha)
              }
            : {name: entry.name, mode: entry.mode, sha: entry.sha}
        )
    return new ReadonlyTree({sha: root, entries: build(root)})
  }
}
