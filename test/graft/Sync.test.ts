import type {GraftApi} from '#/backend/api/GraftApi.js'
import {graft} from '#/backend/api/graft.js'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {DatabaseStateTable} from '#/database/DatabaseTables.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {commit, type Person} from '@alinea/graft'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'

const Page = Config.document('Page', {
  fields: {body: Field.text('Body', {multiline: true})}
})
const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})
const config = cms.config
const context = {
  apiKey: 'test',
  handlerUrl: new URL('http://localhost/api'),
  isDev: false
}
const person: Person = {
  name: 'Ada',
  email: 'ada@example.com',
  timestamp: 0,
  timezone: '+0000'
}

async function seeded(): Promise<GraftApi> {
  const api = graft()(context, config)
  const build = new LocalDB(config)
  for (const id of ['home', 'about', 'contact'])
    await build.create({type: Page, id, set: {title: id, body: 'Hi'}})
  await api.seed(build)
  return api
}

/** Commit file contents below the content root. */
async function edit(api: GraftApi, files: Record<string, string | undefined>) {
  const head = await api.repo.refs.get(api.ref)
  await commit(api.repo, api.ref, {
    parents: [head!],
    changes: Object.entries(files).map(([path, contents]) =>
      contents === undefined
        ? {op: 'remove', path: `content/${path}`}
        : {
            op: 'put',
            path: `content/${path}`,
            contents: new TextEncoder().encode(contents)
          }
    ),
    author: person,
    committer: person,
    message: 'Edit\n'
  })
}

function page(id: string, title: string) {
  return JSON.stringify(
    {_id: id, _type: 'Page', _index: 'a0', _i18nId: id, title, body: 'Hi'},
    null,
    2
  )
}

test('an index syncs from the head of a store without recording a tree', async () => {
  const api = await seeded()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const index = new EntryDatabase(config, db)
  try {
    await index.syncWith(api)
    const head = await api.getHead()
    expect(await index.getRevision()).toBe(head.sha)
    const state = await db.select().from(DatabaseStateTable).get()
    expect(state?.tree ?? null).toBeNull()

    await edit(api, {'pages/about.json': page('about', 'About us')})
    const result = await index.syncWith(api)
    expect(result.changedEntryIds).toEqual(['about'])
    expect(
      await index.resolve({id: 'about', first: true, select: Entry.title})
    ).toBe('About us')
    const tree = await index.getTree()
    expect(tree.sha).toBe((await api.getHead()).sha)
    const sha = tree.getLeaf('pages/about.json').sha
    const [[, blob]] = await Array.fromAsync(index.getBlobs([sha]))
    expect(new TextDecoder().decode(blob)).toBe(page('about', 'About us'))
  } finally {
    await index.close()
  }
})
