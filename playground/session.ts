import {Entry} from '#/core/Entry.js'
import {Config as ConfigBuilder, Field, Query} from '#/index.js'
import {createCMS} from '#/core.js'
import {Config as ConfigUtils} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {mkdtemp, stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

export const Doc = ConfigBuilder.document('Doc', {
  contains: ['Doc'],
  fields: {
    title: Field.text('Title'),
    body: Field.text('Body', {searchable: true}),
    score: Field.number('Score'),
    flag: Field.check('Flag'),
    path: Field.path('Path')
  }
})

export const cms = createCMS({
  schema: {Doc},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {pages: ConfigBuilder.root('Pages', {contains: ['Doc']})}
    })
  }
})

export interface RemoteDoc {
  id: string
  title: string
  body: string
  score: number
  flag: boolean
  parentPaths?: Array<string>
  status?: 'draft' | 'published' | 'archived'
}

const WORDS =
  'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega red green blue yellow orange purple pink brown black white gray bright dark chocolate cake cookie honey butter sugar light heavy short long tall small large round square flat deep river mountain forest desert ocean lake stone wood fire water earth wind star moon sun cloud rain snow leaf flower grass sand wave shell pearl coral reef meadow hill valley trail bridge tower castle garden market harbor village city road bridge'.split(
    ' '
  )

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function bodyFor(seed: number, words = 60): string {
  const rand = mulberry32(seed * 2654435761 + 97)
  return Array.from(
    {length: words},
    () => WORDS[Math.floor(rand() * WORDS.length)]
  ).join(' ')
}

async function recordFor(doc: RemoteDoc, index: string) {
  const status = doc.status ?? 'published'
  const parentPaths = doc.parentPaths ?? []
  const record = createRecord(
    {
      id: doc.id,
      type: 'Doc',
      index,
      parentId: parentPaths.length > 0 ? '__parent__' : null,
      root: 'pages',
      path: doc.id,
      title: doc.title,
      seeded: null,
      data: {
        title: doc.title,
        body: doc.body,
        score: doc.score,
        flag: doc.flag,
        path: doc.id
      }
    },
    status
  )
  const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
  const file = [...parentPaths, doc.id].join('/')
  const suffix = status === 'published' ? '' : `.${status}`
  return {
    op: 'add' as const,
    path: ConfigUtils.filePath(cms.config, 'main', 'pages', null, `${file}${suffix}.json`),
    sha: await hashBlob(contents),
    contents
  }
}

export function remoteDocs(count: number, offset = 0): Array<RemoteDoc> {
  return Array.from({length: count}, (_, i) => {
    const n = offset + i
    return {
      id: `doc-${n}`,
      title: `Document ${n}`,
      body: bodyFor(n),
      score: n % 100,
      flag: n % 2 === 0
    }
  })
}

/** A live playground session: local SQLite store plus an editable remote. */
export class Playground {
  store!: EntryStore
  remote = new MemorySource()
  remoteDocs = new Map<string, RemoteDoc>()
  databasePath: string
  #dir: string
  #counter = 0

  static async open(): Promise<Playground> {
    const session = new Playground()
    const dir = await mkdtemp(join(tmpdir(), 'alinea-playground-'))
    session.#dir = dir
    session.databasePath = join(dir, 'entries.sqlite')
    const db = await runtimeDatabase({path: session.databasePath})
    await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
    const database = new EntryDatabase(cms.config, db)
    session.store = new EntryStore(cms.config, database, new MemorySource(), {
      ownsDatabase: true
    })
    return session
  }

  /** Replace the remote contents wholesale (used for seeding). */
  async seedRemote(docs: Array<RemoteDoc>): Promise<void> {
    this.remote = new MemorySource()
    this.remoteDocs = new Map(docs.map(doc => [doc.id, doc]))
    const changes = await Promise.all(
      docs.map(async (doc, index) =>
        recordFor(doc, `a${String(index).padStart(6, '0')}`)
      )
    )
    const tree = await this.remote.getTree()
    await this.remote.applyChanges({fromSha: tree.sha, changes})
  }

  /** Edit one remote file incrementally (simulates a cloud change). */
  async editRemote(doc: RemoteDoc): Promise<void> {
    this.remoteDocs.set(doc.id, doc)
    const tree = await this.remote.getTree()
    const change = await recordFor(doc, `a${String(this.#counter++).padStart(6, '0')}`)
    await this.remote.applyChanges({
      fromSha: tree.sha,
      changes: [{...change, op: 'add' as const}]
    })
  }

  async removeRemote(id: string): Promise<void> {
    this.remoteDocs.delete(id)
    const tree = await this.remote.getTree()
    const files = Array.from(tree.index().keys()).filter(path =>
      path.endsWith(`/${id}.json`) || path.endsWith(`/${id}.draft.json`) || path.endsWith(`/${id}.archived.json`)
    )
    await this.remote.applyChanges({
      fromSha: tree.sha,
      changes: files.map(path => ({op: 'remove' as const, path}))
    })
  }

  async databaseBytes(): Promise<number> {
    return (await stat(this.databasePath)).size
  }

  async close(): Promise<void> {
    await this.store.close()
    const {rm} = await import('node:fs/promises')
    await rm(this.#dir, {recursive: true, force: true})
  }
}

export {Query}
export {Entry}
