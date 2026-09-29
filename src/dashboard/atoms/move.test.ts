import {expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {
  canMoveTo,
  isCurrentMoveTarget,
  loadMoveTreeAtom,
  moveEntriesAtom,
  moveTargetView,
  resolveMoveTargets,
  rootAcceptsType,
  type MoveCandidate,
  type MoveSubject
} from './move.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'

const Page = Config.document('Page', {
  contains: ['Page', 'Blog'],
  fields: {title: Field.text('Title')}
})
const Blog = Config.document('Blog', {
  contains: ['Post'],
  fields: {title: Field.text('Title')}
})
const Post = Config.document('Post', {fields: {title: Field.text('Title')}})
const Archive = Config.document('Archive', {
  contains: ['Page'],
  hidden: true,
  fields: {}
})

const config = Config.create({
  schema: {Page, Blog, Post, Archive},
  workspaces: {
    main: Config.workspace('Main', {
      source: '.',
      roots: {
        pages: Config.root('Pages', {contains: ['Page', 'Blog']}),
        open: Config.root('Open'),
        media: Config.media()
      }
    })
  }
})

function rootData(name: string) {
  return getRoot(getWorkspace(config.workspaces.main).roots[name])
}

function candidate(
  id: string,
  type: string,
  parents: Array<string> = [],
  locale: string | null = null
): MoveCandidate {
  return {
    id,
    title: id,
    type,
    status: 'published',
    main: true,
    locale,
    parentId: parents.at(-1) ?? null,
    parents
  }
}

function subject(
  id: string,
  type: string,
  parents: Array<string> = [],
  root = 'pages'
): MoveSubject {
  return {
    id,
    title: id,
    type,
    workspace: 'main',
    root,
    locale: null,
    parentId: parents.at(-1) ?? null,
    parents
  }
}

const pages = [
  candidate('home', 'Page'),
  candidate('about', 'Page', ['home']),
  candidate('team', 'Page', ['home', 'about']),
  candidate('blog', 'Blog', ['home']),
  candidate('archive', 'Archive')
]

function targetsFor(
  subjects: Array<MoveSubject>,
  options: {
    policy?: Policy
    root?: string
    candidates?: Array<MoveCandidate>
  } = {}
) {
  const root = options.root ?? 'pages'
  return resolveMoveTargets({
    config,
    policy: options.policy ?? Policy.ALLOW_ALL,
    rootData: rootData(root),
    workspace: 'main',
    root,
    subjects,
    candidates: options.candidates ?? pages
  })
}

test('only lists entries whose type contains the moved type', () => {
  const targets = targetsFor([subject('post', 'Post', ['home', 'blog'])])
  expect([...targets.accepts]).toEqual(['blog'])
  // The ancestors of a target are listed to reach it
  expect(targets.candidates.map(entry => entry.id)).toEqual(['home', 'blog'])
  expect(targets.rootAccepts).toBe(false)
})

test('never moves an entry into itself or its children', () => {
  const targets = targetsFor([subject('about', 'Page', ['home'])])
  expect([...targets.accepts]).toEqual(['home'])
  expect(targets.candidates.map(entry => entry.id)).toEqual(['home'])
  expect(targets.rootAccepts).toBe(true)
})

test('skips hidden container types', () => {
  const targets = targetsFor([subject('team', 'Page', ['home', 'about'])])
  expect(targets.accepts.has('archive')).toBe(false)
})

test('every moved entry must fit in a target', () => {
  const targets = targetsFor([
    subject('team', 'Page', ['home', 'about']),
    subject('post', 'Post', ['home', 'blog'])
  ])
  expect(targets.accepts.size).toBe(0)
  expect(targets.candidates).toEqual([])
  expect(targets.rootAccepts).toBe(false)
})

test('follows the move permission of the target', () => {
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({id: 'about', deny: {move: true}})
  const targets = targetsFor([subject('post', 'Page', ['home', 'blog'])], {
    policy
  })
  expect(targets.accepts.has('about')).toBe(false)
  expect(targets.accepts.has('home')).toBe(true)
})

test('roots accept the types they contain, or anything without contains', () => {
  expect(rootAcceptsType(config, rootData('pages'), 'Page')).toBe(true)
  expect(rootAcceptsType(config, rootData('pages'), 'Post')).toBe(false)
  expect(rootAcceptsType(config, rootData('open'), 'Post')).toBe(true)
  expect(rootAcceptsType(config, rootData('media'), 'MediaFile')).toBe(true)
  expect(rootAcceptsType(config, rootData('media'), 'MediaLibrary')).toBe(true)
})

test('the current location can not be picked', () => {
  const targets = targetsFor([subject('about', 'Page', ['home'])])
  expect(isCurrentMoveTarget(targets, 'home')).toBe(true)
  expect(canMoveTo(targets, 'home')).toBe(false)
  expect(canMoveTo(targets, null)).toBe(true)
  expect(canMoveTo(targets, undefined)).toBe(false)
  expect(canMoveTo(targets, 'blog')).toBe(false)
})

test('the tree shows the targets in the chosen locale', () => {
  const targets = targetsFor([subject('post', 'Page')], {
    candidates: [
      candidate('home', 'Page', [], 'en'),
      {...candidate('home', 'Page', [], 'fr'), title: 'Accueil'},
      candidate('about', 'Page', ['home'], 'en')
    ]
  })
  const collapsed = moveTargetView(targets, 'fr', new Set(), 'about')
  expect(collapsed.snapshot.items).toEqual([{id: 'home', children: []}])
  expect(collapsed.entries.get('home')?.title).toBe('Accueil')
  expect(collapsed.entries.get('home')?.hasChildren).toBe(true)
  expect(collapsed.snapshot.selectedKeys).toEqual(new Set(['about']))
  const expanded = moveTargetView(targets, 'en', new Set(['home']), null)
  expect(expanded.snapshot.items).toEqual([
    {id: 'home', children: [{id: 'about', children: []}]}
  ])
  expect(expanded.snapshot.selectedKeys).toEqual(new Set())
})

test('moves media files into a folder', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const folder = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Folder', path: 'folder'}
  })
  const nested = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    parentId: folder._id,
    set: {title: 'Nested', path: 'nested'}
  })
  const files = await Promise.all(
    ['one', 'two'].map(name =>
      db.create({
        type: MediaFile,
        workspace: 'main',
        root: 'media',
        set: {title: name, path: name, location: `${name}.jpg`}
      })
    )
  )
  const store = createDashboardStore(config, db)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  await store.get(userPolicyReadyAtom)

  const tree = await store.set(
    loadMoveTreeAtom,
    files.map(file => subject(file._id, 'MediaFile', [], 'media')),
    null
  )
  expect(tree.targets.rootAccepts).toBe(true)
  expect([...tree.targets.accepts].sort()).toEqual(
    [folder._id, nested._id].sort()
  )
  expect(store.get(tree.canConfirm)).toBe(false)
  store.set(tree.pick, null)
  // The files are at the root already
  expect(store.get(tree.canConfirm)).toBe(false)
  store.set(tree.pick, nested._id)
  expect(store.get(tree.canConfirm)).toBe(true)

  await store.set(moveEntriesAtom, tree)

  const moved = await db.find({
    id: {in: files.map(file => file._id)},
    select: {parentId: Entry.parentId}
  })
  expect(moved.map(file => file.parentId)).toEqual([nested._id, nested._id])
})

test('a folder can not be moved into its own subfolder', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const folder = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Folder', path: 'folder'}
  })
  await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    parentId: folder._id,
    set: {title: 'Nested', path: 'nested'}
  })
  const other = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Other', path: 'other'}
  })
  const store = createDashboardStore(config, db)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  await store.get(userPolicyReadyAtom)

  const tree = await store.set(
    loadMoveTreeAtom,
    [subject(folder._id, 'MediaLibrary', [], 'media')],
    null
  )
  expect([...tree.targets.accepts]).toEqual([other._id])
})
