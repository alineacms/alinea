import {suite} from '@alinea/suite'
import {Config} from 'alinea'
import {createCMS} from '#/core.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'

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
const cms = createCMS({schema: {Page}, workspaces: {main}} as never)

test('seed multiple languages', async () => {
  const db = new SourceDB(cms.config)
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
  const db = new SourceDB(cms.config, source)

  const results = await Promise.allSettled([db.sync(), db.sync()])

  test.is(results.filter(result => result.status === 'rejected').length, 0)
  test.is(db.sha, (await source.getTree()).sha)
})
