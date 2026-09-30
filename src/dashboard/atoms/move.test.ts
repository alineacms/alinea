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
  loadMoveTargetsAtom,
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
        intl: Config.root('Intl', {
          contains: ['Page', 'Blog'],
          i18n: {locales: ['en', 'fr']}
        }),
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

test('entries inside another moved entry move along with it', () => {
  const selected = [
    subject('post', 'Post', ['home', 'blog']),
    subject('blog', 'Blog', ['home'])
  ]
  const targets = moveTargets(
    config,
    Policy.ALLOW_ALL,
    rootData('pages'),
    selected
  )
  expect(targets.subjects.map(subject => subject.id)).toEqual(['blog'])
  // The post does not limit the targets to entries that hold posts
  expect(targetsFor(selected)).toEqual({
    ids: ['home', 'about', 'team'],
    rootAccepts: true
  })
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

test('moves an entry together with a child also in the batch', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const create = (title: string, parentId?: string) =>
    db.create({
      type: Page,
      workspace: 'main',
      root: 'pages',
      parentId,
      set: {title, path: title}
    })
  const target = await create('target')
  const parent = await create('parent')
  const child = await create('child', parent._id)
  const store = createDashboardStore(config, db)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  await store.get(userPolicyReadyAtom)
  // Eg. both found in search results, the child listed first
  await store.set(
    moveEntriesAtom,
    [subject(child._id, 'Page', [parent._id]), subject(parent._id, 'Page')],
    target._id
  )
  const moved = await db.find({
    id: {in: [parent._id, child._id]},
    select: {id: Entry.id, parentId: Entry.parentId}
  })
  expect(moved).toEqual(
    expect.arrayContaining([
      {id: parent._id, parentId: target._id},
      {id: child._id, parentId: parent._id}
    ])
  )
})

/** Pages of a root with languages, one of which exists in English only */
async function intlFixture() {
  const db = new LocalDB(config)
  await db.sync()
  const page = async (title: string, locales: Array<string>) => {
    const [first, ...others] = locales
    const created = await db.create({
      type: Page,
      workspace: 'main',
      root: 'intl',
      locale: first,
      set: {title, path: title}
    })
    for (const locale of others)
      await db.create({
        type: Page,
        id: created._id,
        locale,
        set: {title, path: title}
      })
    return created
  }
  const store = createDashboardStore(config, db)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  await store.get(userPolicyReadyAtom)
  const intl = (id: string, locale: string | null = 'en') => ({
    ...subject(id, 'Page', [], 'intl'),
    locale
  })
  return {db, store, page, intl}
}

test('only picks targets that exist in every language of the moved entries', async () => {
  const {store, page, intl} = await intlFixture()
  const both = await page('both', ['en', 'fr'])
  const english = await page('english', ['en'])
  const moved = await page('moved', ['en', 'fr'])
  const targets = await store.set(loadMoveTargetsAtom, [intl(moved._id)])
  expect(
    targets.canSelect({...candidate(both._id, 'Page'), locale: 'en'})
  ).toBe(true)
  expect(
    targets.canSelect({...candidate(english._id, 'Page'), locale: 'en'})
  ).toBe(false)
})

test('moves every entry or none', async () => {
  const {db, store, page, intl} = await intlFixture()
  const english = await page('english', ['en'])
  const single = await page('single', ['en'])
  const moved = await page('moved', ['en', 'fr'])
  // The French version of the second entry has no parent to move into
  await expect(
    store.set(moveEntriesAtom, [intl(single._id), intl(moved._id)], english._id)
  ).rejects.toThrow()
  const parents = await db.find({
    id: {in: [single._id, moved._id]},
    status: 'all',
    select: Entry.parentId
  })
  expect(parents.every(parentId => parentId === null)).toBe(true)
})
