import {beforeEach, describe, expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {createCMS} from '#/core.js'
import {Config, Field} from '#/index.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith} from '#/core/source/Source.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {cms} from '#test/cms.js'
import {SourceDB} from './SourceDB.js'

describe('SourceDB', () => {
  let db: SourceDB

  beforeEach(async () => {
    const source = new MemorySource()
    await syncWith(source, new FSSource('test/fixtures/demo'))
    db = new SourceDB(cms.config, source)
    await db.sync()
  })

  test('queries through the runtime resolver', async () => {
    const recipes = await db.find({
      type: cms.schema.DemoRecipe,
      select: {id: Entry.id, title: Entry.title}
    })
    expect(recipes.length).toBe(4)
    expect(recipes.every(recipe => recipe.id && recipe.title)).toBe(true)
  })

  test('writes through runtime source transactions', async () => {
    const recipe = await db.get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip'
    })
    const updated = await db.update({
      type: cms.schema.DemoRecipe,
      id: recipe._id,
      set: {title: 'Chocolate Chip Cookies'}
    })
    expect(updated.title).toBe('Chocolate Chip Cookies')
    expect(db.sha).not.toBe('')
  })

  test('emits exact logical ids after a write', async () => {
    const ids = new Set<string>()
    db.addEventListener('index', event => {
      if ('data' in event && event.data && typeof event.data === 'object') {
        const data = event.data as {ids?: Array<string>}
        for (const id of data.ids ?? []) ids.add(id)
      }
    })
    const recipe = await db.get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip'
    })
    await db.update({
      type: cms.schema.DemoRecipe,
      id: recipe._id,
      set: {title: 'Changed'}
    })
    expect(ids).toEqual(new Set([recipe._id]))
  })

  test('materializes configured pages once across locales', async () => {
    const Page = Config.document('Page', {
      fields: {title: Field.text('Title')}
    })
    const main = Config.workspace('Main', {
      source: 'content/main',
      roots: {
        pages: Config.root('Pages', {
          i18n: {locales: ['en', 'de']},
          children: {
            home: Config.page({
              type: Page,
              fields: {title: 'Home'},
              children: {
                child: Config.page({type: Page, fields: {title: 'Child'}})
              }
            })
          }
        })
      }
    })
    const seededCms = createCMS({schema: {Page}, workspaces: {main}})
    const seeded = new SourceDB(seededCms.config)

    await seeded.sync()
    const entries = await seeded.find({select: Entry, status: 'all'})
    expect(entries.length).toBe(4)
    const homes = entries.filter(entry => entry.path === 'home')
    expect(homes.length).toBe(2)
    expect(homes[0].id).toBe(homes[1].id)

    const revision = seeded.sha
    await seeded.sync()
    expect(seeded.sha).toBe(revision)
    expect(await seeded.count({status: 'all'})).toBe(4)

    const home = homes[0]
    const invalid = createRecord(home, home.status)
    delete invalid.title
    const contents = new TextEncoder().encode(JSON.stringify(invalid, null, 2))
    const tree = await seeded.source.getTree()
    await seeded.source.applyChanges({
      fromSha: tree.sha,
      changes: [
        {
          op: 'add',
          path: home.filePath,
          sha: await hashBlob(contents),
          contents
        }
      ]
    })

    await seeded.fix()
    const fixedTree = await seeded.source.getTree()
    const [fixed] = await Array.fromAsync(
      seeded.source.getBlobs([fixedTree.getLeaf(home.filePath).sha])
    )
    const stored = JSON.parse(new TextDecoder().decode(fixed[1]))
    expect(stored.title).toBe('Home')
  })
})
