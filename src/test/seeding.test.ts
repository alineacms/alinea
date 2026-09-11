import {createCMS} from '#/core.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {}
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      i18n: {
        locales: ['en', 'fr']
      },
      children: {
        page1: Config.page({
          type: Page
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

test('seed multiple languages', async () => {
  const db = new LocalDB(cms.config)
  await db.sync()
  const page1EN = await db.get({
    locale: 'en',
    path: 'page1'
  })
  const page1FR = await db.get({
    locale: 'fr',
    path: 'page1'
  })
  test.is(page1EN._id, page1FR._id)
})

test('seed fields follow config changes until explicitly edited', async () => {
  const Vat = Config.document('VAT', {
    fields: {rate: Field.number('Rate')}
  })
  function config(title: string, rate: number) {
    return createCMS({
      schema: {Vat},
      workspaces: {
        main: Config.workspace('Main', {
          source: 'content',
          roots: {
            pages: Config.root('Pages', {
              children: {
                vat: Config.page({type: Vat, fields: {title, rate}})
              }
            })
          }
        })
      }
    }).config
  }
  const source = new MemorySource()
  const initial = new LocalDB(config('BTW', 6), source)
  await initial.sync()
  const entry = await initial.get({type: Vat, path: 'vat'})
  test.is(entry.title, 'BTW')
  test.is(entry.rate, 6)
  for (const sha of (await source.getTree()).index().values()) {
    for await (const [, blob] of source.getBlobs([sha])) {
      const record = JSON.parse(new TextDecoder().decode(blob))
      test.is('title' in record, false)
      test.is('rate' in record, false)
    }
  }

  const changed = new LocalDB(config('VAT', 12), source)
  await changed.sync()
  const updated = await changed.get({type: Vat, path: 'vat'})
  test.is(updated.title, 'VAT')
  test.is(updated.rate, 12)

  await changed.update({type: Vat, id: entry._id, set: {title: 'Edited'}})
  const reindexed = new LocalDB(config('New default', 21), source)
  await reindexed.sync()
  test.is((await reindexed.get({type: Vat, path: 'vat'})).title, 'Edited')
})

test('serializes concurrent seeding on the same index', async () => {
  let firstApply: () => void = () => {}
  const applied = new Promise<void>(resolve => {
    firstApply = resolve
  })
  let treeReads = 0
  const source = new (class extends MemorySource {
    override async getTree() {
      treeReads++
      if (treeReads <= 2) return ReadonlyTree.EMPTY
      await applied
      return super.getTree()
    }

    override async applyChanges(
      ...args: Parameters<MemorySource['applyChanges']>
    ) {
      await super.applyChanges(...args)
      firstApply()
    }
  })()
  const db = new LocalDB(cms.config, source)

  const results = await Promise.allSettled([db.sync(), db.sync()])

  test.is(results.filter(result => result.status === 'rejected').length, 0)
  const sourceTree = await source.getTreeIfDifferent(ReadonlyTree.EMPTY.sha)
  if (!sourceTree) throw new Error('Expected the seeded source tree')
  test.is(await db.sha, sourceTree.sha)
})
