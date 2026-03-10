import {suite} from '@alinea/suite'
import type {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {LocalDB} from 'alinea/core/db/LocalDB'
import type {LocalDB as LocalDBType} from 'alinea/core/db/LocalDB'
import {root} from 'alinea/core/Root'
import {FSSource} from 'alinea/core/source/FSSource'
import {Workspace, workspace} from 'alinea/core/Workspace'
import {createStore, type WritableAtom} from 'jotai'
import {cpSync, mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {configAtom} from '../atoms/config.js'
import {
  applyTreeRouteStateCommand,
  focusTreeNodeCommand,
  focusTreeParentCommand,
  moveTreeNodeCommand,
  treeBootstrapAtom,
  treeExpandedKeysAtom,
  treeFocusedNodeIdAtom,
  treeItemsAtom,
  treeSelectedKeysAtom,
  treeViewAtom
} from '../atoms/cms/tree.js'
import {dbAtom} from '../atoms/db.js'
import {cms} from '../fixture/cms.js'

const test = suite(import.meta)

function fixtureContentDir() {
  return fileURLToPath(new URL('../fixture/content', import.meta.url))
}

async function createDbFromFS() {
  const fixtureDir = fixtureContentDir()
  const tempDir = mkdtempSync(`${tmpdir()}/alinea-sidebar-tree-`)
  cpSync(fixtureDir, tempDir, {recursive: true})
  const source = new FSSource(tempDir)
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

function configWithSimpleRootOpenByDefault(config: Config): Config {
  const simple = config.workspaces.simple
  const simpleData = Workspace.data(simple)
  return {
    ...config,
    workspaces: {
      ...config.workspaces,
      simple: workspace(Workspace.label(simple), {
        ...simpleData,
        roots: {
          ...Workspace.roots(simple),
          pages: root('Pages', {
            contains: ['Page', 'Folder'],
            openByDefault: true
          })
        }
      })
    }
  }
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
  const home = rootView.items.find(item => item.node.title === 'Home')
  test.is(Boolean(home), true)
  if (!home) throw new Error('Expected Home node to exist')
  test.is(home.node.typeName, 'Page')
  test.is(home.node.isContainer, true)

  const about = rootView.items.find(item => item.node.title === 'About')
  test.is(Boolean(about), true)
  if (!about) throw new Error('Expected About node to exist')
  test.is(about.node.typeName, 'Page')
  test.is(about.node.isContainer, true)
  await store.set(focusTreeNodeCommand, about.id)
  test.is(store.get(treeFocusedNodeIdAtom), rootId)

  const blog = rootView.items.find(item => item.node.title === 'Blog')
  test.is(Boolean(blog), true)
  if (!blog) throw new Error('Expected Blog node to exist')
  test.is(blog.node.typeName, 'Folder')
  test.is(blog.node.isContainer, true)
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
  test.equal(topView.items.map(item => item.node.title), ['Pages', 'Media'])
})

test('expands roots marked openByDefault when initializing the sidebar tree', async () => {
  const db = await createDbFromFS()
  const store = createStore()
  const config = configWithSimpleRootOpenByDefault(cms.config)
  setRequiredAtoms(store, db)
  store.set(
    configAtom as unknown as WritableAtom<Config, [Config], void>,
    config
  )

  await store.set(treeBootstrapAtom)

  const rootId = 'root:simple:pages'
  const expandedKeys = store.get(treeExpandedKeysAtom)
  test.is(expandedKeys.has(rootId), true)

  const treeItems = store.get(treeItemsAtom)
  test.equal(treeItems.map(item => item.node.title), ['Pages', 'Media'])
  test.equal(
    treeItems[0]?.children?.map(item => item.node.title),
    ['Home', 'About', 'Blog']
  )
})

test('syncs tree state from route for root, branch and leaf entry paths', async () => {
  const db = await createDbFromFS()
  const store = createStore()
  setRequiredAtoms(store, db)

  await store.set(applyTreeRouteStateCommand, {
    workspace: 'simple',
    root: 'pages'
  })
  test.is(store.get(treeFocusedNodeIdAtom), 'root:simple:pages')
  test.equal(Array.from(store.get(treeSelectedKeysAtom)), ['root:simple:pages'])

  await store.set(applyTreeRouteStateCommand, {
    workspace: 'simple',
    root: 'pages',
    entry: 'blog'
  })
  const blogSelected = Array.from(store.get(treeSelectedKeysAtom))[0]
  test.is(Boolean(blogSelected), true)
  if (!blogSelected) throw new Error('Expected selected blog node')
  test.is(store.get(treeFocusedNodeIdAtom), blogSelected)

  await store.set(applyTreeRouteStateCommand, {
    workspace: 'simple',
    root: 'pages',
    entry: 'about'
  })
  const aboutSelected = Array.from(store.get(treeSelectedKeysAtom))[0]
  test.is(Boolean(aboutSelected), true)
  if (!aboutSelected) throw new Error('Expected selected about node')
  test.is(store.get(treeFocusedNodeIdAtom), 'root:simple:pages')
})

test('roots without visible children do not expose child nodes', async () => {
  const db = await createDbFromFS()
  const store = createStore()
  setRequiredAtoms(store, db)

  await store.set(treeBootstrapAtom)

  const treeItems = store.get(treeItemsAtom)
  const mediaRoot = treeItems.find(item => item.node.title === 'Media')
  test.is(Boolean(mediaRoot), true)
  if (!mediaRoot) throw new Error('Expected Media root')
  test.is(mediaRoot.hasChildNodes, false)
})

test('moves a leaf entry into a folder from the sidebar tree', async () => {
  const db = await createDbFromFS()
  const store = createStore()
  setRequiredAtoms(store, db)

  await store.set(applyTreeRouteStateCommand, {
    workspace: 'simple',
    root: 'pages'
  })

  const rootView = store.get(treeViewAtom)
  const about = rootView.items.find(item => item.node.title === 'About')
  test.is(Boolean(about), true)
  if (!about) throw new Error('Expected About node to exist')

  const blog = rootView.items.find(item => item.node.title === 'Blog')
  test.is(Boolean(blog), true)
  if (!blog) throw new Error('Expected Blog node to exist')

  const nextRoute = await store.set(moveTreeNodeCommand, about.id, {
    key: blog.id,
    dropPosition: 'on'
  })
  test.is(nextRoute?.workspace, 'simple')
  test.is(nextRoute?.root, 'pages')
  test.is(nextRoute?.entry, about.node.entryId)

  const movedEntry = await db.first({
    id: about.node.entryId,
    select: {
      parentId: Entry.parentId,
      root: Entry.root
    },
    status: 'preferDraft'
  })
  test.is(movedEntry?.parentId, blog.node.entryId)
  test.is(movedEntry?.root, 'pages')

  const blogView = store.get(treeViewAtom)
  test.is(blogView.focusItem?.node.title, 'Blog')
  test.equal(
    blogView.items.map(item => item.node.title),
    ['Hello world', 'Release notes', 'About']
  )
  test.equal(Array.from(store.get(treeSelectedKeysAtom)), [about.id])
})
