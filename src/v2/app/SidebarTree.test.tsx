import {suite} from '@alinea/suite'
import type {Config} from 'alinea/core/Config'
import {LocalDB} from 'alinea/core/db/LocalDB'
import type {LocalDB as LocalDBType} from 'alinea/core/db/LocalDB'
import {FSSource} from 'alinea/core/source/FSSource'
import {createStore, type WritableAtom} from 'jotai'
import {fileURLToPath} from 'node:url'
import {configAtom} from '../atoms/config.js'
import {
  focusTreeNodeCommand,
  focusTreeParentCommand,
  treeFocusedNodeIdAtom,
  treeViewAtom
} from '../atoms/cms/tree.js'
import {dbAtom} from '../atoms/db.js'
import {cms} from '../fixture/cms.js'

const test = suite(import.meta)

function fixtureContentDir() {
  return fileURLToPath(new URL('../fixture/content', import.meta.url))
}

async function createDbFromFS() {
  const source = new FSSource(fixtureContentDir())
  const db = new LocalDB(cms.config, source)
  await db.sync()
  return db
}

function setRequiredAtoms(store: ReturnType<typeof createStore>, db: LocalDBType) {
  store.set(
    configAtom as unknown as WritableAtom<Config, [Config], void>,
    cms.config
  )
  store.set(
    dbAtom as unknown as WritableAtom<LocalDBType, [LocalDBType], void>,
    db
  )
}

test('drills into loaded nodes and navigates back without refocusing leaves', async () => {
  const db = await createDbFromFS()
  const store = createStore()
  setRequiredAtoms(store, db)

  const rootId = 'root:simple:pages'
  await store.set(focusTreeNodeCommand, rootId)

  const rootView = store.get(treeViewAtom)
  test.is(rootView.focusItem?.node.title, 'Pages')
  test.equal(
    rootView.items.map(item => item.node.title),
    ['Home', 'About', 'Blog']
  )

  const about = rootView.items.find(item => item.node.title === 'About')
  test.is(Boolean(about), true)
  if (!about) throw new Error('Expected About node to exist')
  await store.set(focusTreeNodeCommand, about.id)
  test.is(store.get(treeFocusedNodeIdAtom), rootId)

  const blog = rootView.items.find(item => item.node.title === 'Blog')
  test.is(Boolean(blog), true)
  if (!blog) throw new Error('Expected Blog node to exist')
  await store.set(focusTreeNodeCommand, blog.id)

  const blogView = store.get(treeViewAtom)
  test.is(blogView.focusItem?.node.title, 'Blog')
  test.equal(
    blogView.items.map(item => item.node.title),
    ['Hello world', 'Release notes']
  )

  store.set(focusTreeParentCommand)
  test.is(store.get(treeViewAtom).focusItem?.node.title, 'Pages')

  store.set(focusTreeParentCommand)
  const topView = store.get(treeViewAtom)
  test.is(topView.focusItem, null)
  test.equal(topView.items.map(item => item.node.title), ['Pages'])
})
