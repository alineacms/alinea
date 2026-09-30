import {expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {filterChecker} from '#/core/Filter.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import type {ExplorerItemData} from './explorer.js'
import {
  moveEntriesAtom,
  moveTargets,
  rootAcceptsType,
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
  parents: Array<string> = []
): ExplorerItemData {
  return {
    id,
    title: id,
    path: id,
    type,
    workspace: 'main',
    root: 'pages',
    locale: null,
    parentId: parents.at(-1) ?? null,
    parents,
    index: '',
    data: {},
    hasChildren: false
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

/** The ids of the pages that can be picked to move the subjects into */
function targetsFor(
  subjects: Array<MoveSubject>,
  {policy = Policy.ALLOW_ALL, root = 'pages'} = {}
) {
  const targets = moveTargets(config, policy, rootData(root), subjects)
  const matches = filterChecker(targets.condition, (item, name) =>
    name === '_type' ? (item as ExplorerItemData).type : undefined
  )
  const picked = pages.filter(page => matches(page) && targets.canSelect(page))
  return {ids: picked.map(page => page.id), rootAccepts: targets.rootAccepts}
}

test('only picks entries whose type contains the moved type', () => {
  expect(targetsFor([subject('post', 'Post', ['home', 'blog'])])).toEqual({
    ids: ['blog'],
    rootAccepts: false
  })
})

test('never moves an entry into itself or its children', () => {
  expect(targetsFor([subject('about', 'Page', ['home'])])).toEqual({
    ids: ['home'],
    rootAccepts: true
  })
})

test('skips hidden container types', () => {
  const {ids} = targetsFor([subject('team', 'Page', ['home', 'about'])])
  expect(ids).not.toContain('archive')
})

test('every moved entry must fit in a target', () => {
  expect(
    targetsFor([
      subject('team', 'Page', ['home', 'about']),
      subject('post', 'Post', ['home', 'blog'])
    ])
  ).toEqual({ids: [], rootAccepts: false})
})

test('entries of unknown types can not be moved', () => {
  expect(targetsFor([subject('post', 'Unknown')])).toEqual({
    ids: [],
    rootAccepts: false
  })
})

test('follows the move permission of the target', () => {
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({id: 'about', deny: {move: true}})
  const {ids} = targetsFor([subject('post', 'Page', ['home', 'blog'])], {
    policy
  })
  expect(ids).toEqual(['home'])
})

test('roots accept the types they contain, or anything without contains', () => {
  expect(rootAcceptsType(config, rootData('pages'), 'Page')).toBe(true)
  expect(rootAcceptsType(config, rootData('pages'), 'Post')).toBe(false)
  expect(rootAcceptsType(config, rootData('open'), 'Post')).toBe(true)
  expect(rootAcceptsType(config, rootData('media'), 'MediaFile')).toBe(true)
  expect(rootAcceptsType(config, rootData('media'), 'MediaLibrary')).toBe(true)
})

test('moves media files into a folder and back to the root', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const folder = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Folder', path: 'folder'}
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
  const parentIds = async () => {
    const moved = await db.find({
      id: {in: files.map(file => file._id)},
      select: {parentId: Entry.parentId}
    })
    return moved.map(file => file.parentId)
  }

  await store.set(
    moveEntriesAtom,
    files.map(file => subject(file._id, 'MediaFile', [], 'media')),
    folder._id
  )
  expect(await parentIds()).toEqual([folder._id, folder._id])

  await store.set(
    moveEntriesAtom,
    files.map(file => subject(file._id, 'MediaFile', [folder._id], 'media')),
    null
  )
  expect(await parentIds()).toEqual([null, null])
})
