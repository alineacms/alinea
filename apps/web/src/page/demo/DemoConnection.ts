import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {Config} from 'alinea/core/Config'
import type {
  BackendCapabilities,
  LocalConnection,
  Revision,
  UploadMetadata,
  UploadResponse
} from 'alinea/core/Connection'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import type {Mutation} from 'alinea/core/db/Mutation'
import {type Draft, type DraftKey, formatDraftKey} from 'alinea/core/Draft'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import type {AnyQueryResult, GraphQuery} from 'alinea/core/Graph'
import {createId} from 'alinea/core/Id'
import type {Change} from 'alinea/core/source/Change'
import {hashBlob} from 'alinea/core/source/GitUtils'
import type {MemorySource} from 'alinea/core/source/MemorySource'
import {
  type ExportedSource,
  importSource
} from 'alinea/core/source/SourceExport'
import type {GetBlobsOptions} from 'alinea/core/source/Source'
import {Leaf, type ReadonlyTree} from 'alinea/core/source/Tree'
import type {User, UserInput} from 'alinea/core/User'
import {fileVersions} from 'alinea/core/util/EntryFilenames'
import {isRecord} from 'alinea/core/util/Objects'
import {basename, dirname, extname, join} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {EntryStore} from 'alinea/database/EntryStore'

const storageKey = 'alinea-demo-session'
// A service worker keeps uploaded files and serves them at their media url
const uploadsWorker = '/demo-uploads-sw.js'
const uploadsCache = 'alinea-demo-uploads'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** The signed in demo user, an administrator */
export const demoUser: User = {
  sub: 'demo-maya',
  name: 'Maya Janssens',
  email: 'maya@oakandloom.example',
  roles: ['admin']
}

const tom: User = {
  sub: 'demo-tom',
  name: 'Tom Verbeke',
  email: 'tom@oakandloom.example',
  roles: ['editor']
}

const camille: User = {
  sub: 'demo-camille',
  name: 'Camille Dubois',
  email: 'camille@oakandloom.example',
  roles: ['translator']
}

const lotte: User = {
  sub: 'demo-lotte',
  name: 'Lotte Peeters',
  email: 'lotte@oakandloom.example',
  roles: ['viewer']
}

const initialUsers: Array<User> = [demoUser, tom, camille, lotte]

interface SessionRevision extends Revision {
  /** The committed file contents */
  contents: string
}

interface SessionState {
  /** Tree sha of the exported content the session changes apply to */
  base: string
  /** Files that differ from the exported content, null when removed */
  files: Record<string, string | null>
  revisions: Array<SessionRevision>
  users: Array<User>
}

interface DemoConnectionState {
  initialTree: ReadonlyTree
  initialBlobs: Map<string, Uint8Array>
  session: SessionState | undefined
}

/**
 * A connection that behaves like a real backend, entirely in the browser.
 * Commits are applied to an in-memory source through a server side style
 * entry store, drafts, users and history are kept in memory and the session
 * is mirrored to sessionStorage so a reload keeps the changes.
 */
export class DemoConnection implements LocalConnection {
  #config: Config
  #source: MemorySource
  #store: EntryStore
  #initialTree: ReadonlyTree
  #initialBlobs: Map<string, Uint8Array>
  #revisions: Array<SessionRevision>
  #users: Array<User>
  #drafts = new Map<DraftKey, Draft>()

  constructor(
    config: Config,
    source: MemorySource,
    store: EntryStore,
    {initialTree, initialBlobs, session}: DemoConnectionState
  ) {
    this.#config = config
    this.#source = source
    this.#store = store
    this.#initialTree = initialTree
    this.#initialBlobs = initialBlobs
    this.#revisions = session?.revisions ?? []
    this.#users = session?.users ?? initialUsers
  }

  static async create(
    config: Config,
    exported: ExportedSource
  ): Promise<DemoConnection> {
    registerUploadsWorker()
    const source = await importSource(exported)
    const initialTree = await source.getTree()
    // Keep the exported files around to derive their history from, session
    // changes remove replaced blobs from the source
    const initialBlobs = new Map<string, Uint8Array>()
    for await (const [sha, blob] of source.getBlobs(
      Array.from(initialTree.index().values())
    ))
      initialBlobs.set(sha, blob)
    const session = readSession(initialTree.sha)
    if (session) await restoreFiles(source, session.files)
    const store = await EntryStore.memory(config, source)
    await store.sync()
    return new DemoConnection(config, source, store, {
      initialTree,
      initialBlobs,
      session
    })
  }

  /** The source the local dashboard database falls back to */
  get source(): MemorySource {
    return this.#source
  }

  /** Forget every change made in this browser session */
  async reset(): Promise<void> {
    try {
      sessionStorage.removeItem(storageKey)
      await caches.delete(uploadsCache)
    } catch {
      // Without storage there is nothing to forget
    }
  }

  // Commits

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const policy = await this.#store.createPolicy(demoUser.roles ?? [])
    const request = await this.#store.request(mutations, policy)
    return this.write({...request, user: demoUser})
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const result = await this.#store.write(request)
    this.#recordRevisions(request)
    await this.#persist()
    return result
  }

  #recordRevisions(request: CommitRequest) {
    const createdAt = Date.now()
    const user = request.user ?? demoUser
    for (const change of request.changes) {
      if (change.op !== 'addContent' || !change.path.endsWith('.json')) continue
      this.#revisions.push({
        ref: createId(),
        createdAt,
        file: this.#file(change.path),
        user: {name: user.name ?? 'Unknown', email: user.email ?? ''},
        description: request.description,
        contents: change.contents
      })
    }
  }

  // Sync

  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.#source.getTreeIfDifferent(sha)
  }

  getBlobs(shas: ReadonlyArray<string>, options?: GetBlobsOptions) {
    return this.#source.getBlobs(shas, options)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#store.resolve(query)
  }

  async previewToken(): Promise<string> {
    return 'demo-preview'
  }

  // History

  async revisions(file: string): Promise<Array<Revision>> {
    const versions = new Set(fileVersions(file))
    const session = this.#revisions
      .filter(revision => versions.has(revision.file))
      .map(({contents: _, ...revision}) => revision)
    const seeded = Array.from(versions).flatMap(version =>
      this.#seededHistory(version).map(item => item.revision)
    )
    return session.concat(seeded).sort((a, b) => b.createdAt - a.createdAt)
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const session = this.#revisions.find(
      revision => revision.file === file && revision.ref === revisionId
    )
    if (session)
      return JsonLoader.parse(
        this.#config.schema,
        encoder.encode(session.contents)
      )
    return this.#seededHistory(file).find(
      item => item.revision.ref === revisionId
    )?.record
  }

  /** A believable history of the exported version of a file */
  #seededHistory(file: string): Array<SeededRevision> {
    const path = this.#treePath(file)
    if (!path) return []
    const leaf = this.#initialTree.get(path)
    if (!(leaf instanceof Leaf)) return []
    const blob = this.#initialBlobs.get(leaf.sha)
    if (!blob) return []
    let record: EntryRecord
    try {
      record = JsonLoader.parse(this.#config.schema, blob)
    } catch {
      return []
    }
    return seedHistory(file, path, leaf.sha, record)
  }

  #file(path: string) {
    return join(Config.contentDir(this.#config), path)
  }

  #treePath(file: string): string | undefined {
    const prefix = `${Config.contentDir(this.#config)}/`
    return file.startsWith(prefix) ? file.slice(prefix.length) : undefined
  }

  // Drafts

  async getDraft(draftKey: DraftKey): Promise<Draft | undefined> {
    return this.#drafts.get(draftKey)
  }

  async storeDraft(draft: Draft): Promise<void> {
    this.#drafts.set(
      formatDraftKey({id: draft.entryId, locale: draft.locale}),
      draft
    )
  }

  // Uploads

  async prepareUpload(
    file: string,
    _metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    const entryId = createId()
    const extension = extname(file).toLowerCase()
    const name = basename(file, extension)
    const fileName = `${slugify(name)}${extension}`
    const location = join(
      dirname(file),
      `${slugify(name)}.${entryId}${extension}`
    )
    // The file stays in the browser: the uploads worker keeps it and serves
    // it at the media url, which ends in the same file name. Without the
    // worker the upload goes nowhere and the entry keeps its preview image.
    const url = navigator.serviceWorker?.controller
      ? `/demo/__upload?name=${encodeURIComponent(fileName)}`
      : 'data:,'
    return {entryId, location, previewUrl: '', url, method: 'POST'}
  }

  // Users

  async capabilities(): Promise<BackendCapabilities> {
    return {users: true}
  }

  async user(): Promise<User> {
    return demoUser
  }

  async enrichUser(user: User): Promise<User> {
    return this.#users.find(item => item.sub === user.sub) ?? user
  }

  async listUsers(): Promise<Array<User>> {
    return this.#users
  }

  async createUser(input: UserInput): Promise<User> {
    const email = input.email?.trim().toLowerCase()
    if (!email) throw new Error('An email address is required')
    if (this.#users.some(user => user.email?.toLowerCase() === email))
      throw new Error(`A user with email ${email} already exists`)
    const user: User = {...input, email, sub: `demo-${createId()}`}
    this.#users = [...this.#users, user]
    await this.#persist()
    return user
  }

  async updateUser(input: UserInput): Promise<User> {
    const email = input.email?.toLowerCase()
    const existing = this.#users.find(
      user =>
        (input.sub && user.sub === input.sub) ||
        user.email?.toLowerCase() === email
    )
    if (!existing) throw new Error('User not found')
    const updated: User = {...existing, ...input, sub: existing.sub}
    this.#users = this.#users.map(user => (user === existing ? updated : user))
    await this.#persist()
    return updated
  }

  async removeUser(email: string): Promise<void> {
    if (email.toLowerCase() === demoUser.email)
      throw new Error('You cannot remove yourself')
    this.#users = this.#users.filter(
      user => user.email?.toLowerCase() !== email.toLowerCase()
    )
    await this.#persist()
  }

  // Session

  async #persist() {
    const files: Record<string, string | null> = {}
    const current = await this.#source.getTree()
    const {changes} = this.#initialTree.diff(current)
    const added = changes.filter(change => change.op === 'add')
    const contents = new Map<string, Uint8Array>()
    for await (const [sha, blob] of this.#source.getBlobs(
      added.map(change => change.sha)
    ))
      contents.set(sha, blob)
    for (const change of changes) {
      if (change.op === 'delete') files[change.path] = null
      else files[change.path] = decoder.decode(contents.get(change.sha))
    }
    const state: SessionState = {
      base: this.#initialTree.sha,
      files,
      revisions: this.#revisions,
      users: this.#users
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Changes are kept in memory only when storage is unavailable or full
    }
  }
}

function registerUploadsWorker() {
  try {
    navigator.serviceWorker
      ?.register(uploadsWorker, {scope: '/demo'})
      .catch(() => {
        // Uploads keep their preview image only
      })
  } catch {
    // Service workers are unavailable, eg. in a private window
  }
}

function readSession(base: string): SessionState | undefined {
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (!stored) return
    const state: unknown = JSON.parse(stored)
    if (!isRecord(state) || state.base !== base) return
    return state as unknown as SessionState
  } catch {
    return
  }
}

async function restoreFiles(
  source: MemorySource,
  files: Record<string, string | null>
) {
  const tree = await source.getTree()
  const changes: Array<Change> = []
  for (const [path, contents] of Object.entries(files)) {
    if (contents === null) {
      const leaf = tree.get(path)
      if (leaf instanceof Leaf)
        changes.push({op: 'delete', path, sha: leaf.sha})
      continue
    }
    const bytes = encoder.encode(contents)
    changes.push({op: 'add', path, sha: await hashBlob(bytes), contents: bytes})
  }
  if (changes.length === 0) return
  try {
    await source.applyChanges({fromSha: tree.sha, changes})
  } catch {
    // Start from the exported content if the stored changes no longer apply
  }
}

// Seeded history

type SeedVersion = [record: EntryRecord, description: string, user: User]

interface SeededRevision {
  revision: Revision
  record: EntryRecord
}

const day = 24 * 60 * 60 * 1000
const skippedKeys = new Set([
  'path',
  'location',
  'src',
  'href',
  'url',
  'extension',
  'hash',
  'preview',
  'thumbHash',
  'focus'
])

/**
 * Derive a few earlier revisions of an exported entry: the current version
 * was published on a fixed date in 2026 and earlier versions had slightly
 * shorter texts and a differently cased title.
 */
function seedHistory(
  file: string,
  path: string,
  sha: string,
  record: EntryRecord
): Array<SeededRevision> {
  const hash = hashString(path)
  const title = typeof record.title === 'string' ? record.title : basename(path)
  const translated = /(^|\/)(nl|fr)(\/|$)/.test(dirname(path))
  const editor = translated ? camille : hash % 3 === 0 ? demoUser : tom
  const author = translated ? camille : hash % 2 === 0 ? tom : demoUser
  const count = 2 + (hash % 3)
  // The exported version was published between 18 August and 18 September,
  // during office hours in the local time zone
  let createdAt =
    new Date(2026, 7, 18, 9).getTime() +
    (hash % 31) * day +
    ((hash >> 5) % 9) * 3600000
  const trimmedOnce = editTexts(record, 1)
  // Keep the path of seeded entries, which is otherwise derived from the title
  const entryPath =
    typeof record.path === 'string'
      ? record.path
      : basename(path, '.json').split('.')[0]
  const retitled = {
    ...editTexts(record, 2),
    title: earlierTitle(title),
    path: entryPath
  }
  const current: SeedVersion = [record, `(publish) ${title}`, editor]
  const updated: SeedVersion = [trimmedOnce, `(update) ${title}`, editor]
  const published: SeedVersion = [
    retitled,
    `(publish) ${retitled.title}`,
    author
  ]
  const created: SeedVersion = [
    editTexts(retitled, 4),
    `(create) ${retitled.title}`,
    author
  ]
  const versions =
    count === 4
      ? [current, updated, published, created]
      : count === 3
        ? [current, published, created]
        : [current, created]
  return versions.map(([data, description, user], index) => {
    if (index > 0)
      createdAt -=
        (2 + ((hash >> index) % 11)) * day + (index % 2 ? 3600000 : -3600000)
    return {
      revision: {
        ref: `seed-${sha.slice(0, 12)}-${index}`,
        createdAt,
        file,
        user: {name: user.name ?? '', email: user.email ?? ''},
        description
      },
      record: data
    }
  })
}

/** Shorten the first long texts of a record by a sentence or a few words */
function editTexts(record: EntryRecord, count: number): EntryRecord {
  const budget = {count}
  function visit(value: unknown, key?: string): unknown {
    if (budget.count <= 0) return value
    if (typeof value === 'string') {
      if (key && (key.startsWith('_') || skippedKeys.has(key))) return value
      if (key === 'title' || value.split(/\s+/).length < 8) return value
      budget.count--
      return shorten(value)
    }
    if (Array.isArray(value)) return value.map(item => visit(item))
    if (isRecord(value))
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [name, visit(item, name)])
      )
    return value
  }
  return visit(record) as EntryRecord
}

function shorten(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/)
  if (sentences.length > 1) return sentences.slice(0, -1).join(' ')
  const words = text.split(/\s+/)
  return `${words.slice(0, Math.max(5, words.length - 3)).join(' ')}.`
}

function earlierTitle(title: string): string {
  const words = title.split(' ')
  const sentenceCase = [
    words[0],
    ...words.slice(1).map(word => word.toLowerCase())
  ].join(' ')
  if (sentenceCase !== title) return sentenceCase
  if (words.length >= 3) return words.slice(0, -1).join(' ')
  return title
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
