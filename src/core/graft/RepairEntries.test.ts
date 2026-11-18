import {identifyEntry} from '#/core/graft/IdentifyEntry.js'
import {mergeEntryFiles} from '#/core/graft/MergeEntryFiles.js'
import {repairEntries} from '#/core/graft/RepairEntries.js'
import {Config, Field} from '#/index.js'
import {
  buildTree,
  listFiles,
  memoryRepository,
  mergeTrees,
  type ObjectStore,
  Mode
} from '@alinea/graft'
import {blob, stored} from '@alinea/graft/git'
import {suite} from '@alinea/suite'

const test = suite(import.meta)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const Row = Config.type('Row', {fields: {body: Field.text('Body')}})

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {
    color: Field.text('Color', {shared: true}),
    rows: Field.list('Rows', {schema: {Row}})
  }
})

const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {contains: ['Page']}),
        intl: Config.root('Intl', {
          contains: ['Page'],
          i18n: {locales: ['en', 'fr']}
        })
      }
    })
  }
})

type Files = Record<string, object>

function page(id: string, data: object = {}) {
  return {_id: id, _type: 'Page', _index: 'a0', title: id, ...data}
}

async function tree(store: ObjectStore, files: Files): Promise<string> {
  const objects = await Promise.all(
    Object.values(files).map(value =>
      stored(blob(encoder.encode(JSON.stringify(value, null, '  '))))
    )
  )
  await store.put(objects)
  const built = await buildTree(
    store,
    undefined,
    Object.keys(files).map((path, index) => ({
      path,
      entry: {mode: Mode.file, sha: objects[index].sha}
    }))
  )
  await store.put(built.objects)
  return built.sha
}

async function read(store: ObjectStore, sha: string): Promise<Files> {
  const files = await listFiles(store, sha)
  const blobs = await store.get([...files.values()].map(entry => entry.sha))
  return Object.fromEntries(
    [...files].map(([path, entry]) => [
      path,
      JSON.parse(decoder.decode(blobs.get(entry.sha)!.data))
    ])
  )
}

async function mergeFiles(base: Files, ours: Files, theirs: Files) {
  const {objects: store} = memoryRepository()
  const [b, o, t] = await Promise.all(
    [base, ours, theirs].map(files => tree(store, files))
  )
  const merged = await mergeTrees(store, b, o, t, {
    prefer: 'ours',
    mergeFile: mergeEntryFiles(config),
    identify: identifyEntry(config),
    repair: repairEntries(config)
  })
  await store.put(merged.objects)
  return read(store, merged.sha)
}

test('an edit follows an entry the other side moved', async () => {
  const base = {'content/pages/a.json': page('a')}
  const ours = {'content/pages/b.json': page('a')}
  const theirs = {'content/pages/a.json': page('a', {color: 'red'})}
  test.equal(await mergeFiles(base, ours, theirs), {
    'content/pages/b.json': page('a', {color: 'red'})
  })
})

test('an entry displaced from its path moves to the first free one', async () => {
  const base = {'content/pages/home.json': page('home')}
  const ours = {...base, 'content/pages/new.json': page('x')}
  const theirs = {
    ...base,
    'content/pages/new.json': page('y'),
    'content/pages/new-1.json': page('z')
  }
  const merged = await mergeFiles(base, ours, theirs)
  test.equal(merged['content/pages/new.json'], page('x'))
  test.equal(merged['content/pages/new-1.json'], page('z'))
  test.equal(merged['content/pages/new-2.json'], page('y'))
})

test('a displaced draft keeps its path in step with its file', async () => {
  const ours = {'content/pages/new.draft.json': page('x', {path: 'new'})}
  const theirs = {'content/pages/new.draft.json': page('y', {path: 'new'})}
  const merged = await mergeFiles({}, ours, theirs)
  test.equal(
    merged['content/pages/new-1.draft.json'],
    page('y', {path: 'new-1'})
  )
})

test('a parent removed under a changed entry comes back', async () => {
  const base = {
    'content/pages/parent.json': page('parent'),
    'content/pages/parent/child.json': page('child')
  }
  const ours = {}
  const theirs = {
    ...base,
    'content/pages/parent/child.json': page('child', {color: 'blue'})
  }
  test.equal(await mergeFiles(base, ours, theirs), {
    'content/pages/parent.json': page('parent'),
    'content/pages/parent/child.json': page('child', {color: 'blue'})
  })
})

test('a shared field changed in one translation reaches the others', async () => {
  const base = {
    'content/intl/en/home.json': page('home', {color: 'red'}),
    'content/intl/fr/accueil.json': page('home', {color: 'red'})
  }
  const ours = {
    ...base,
    'content/intl/en/home.json': page('home', {color: 'blue'})
  }
  const theirs = {
    ...base,
    'content/intl/fr/accueil.json': page('home', {
      title: 'Accueil',
      color: 'red'
    })
  }
  test.equal(await mergeFiles(base, ours, theirs), {
    'content/intl/en/home.json': page('home', {color: 'blue'}),
    'content/intl/fr/accueil.json': page('home', {
      title: 'Accueil',
      color: 'blue'
    })
  })
})

test('anchors are unique again after a merge', async () => {
  const row = (id: string, index: string) => ({
    _id: id,
    _index: index,
    _type: 'Row',
    _label: 'Intro',
    _anchor: 'intro',
    body: id
  })
  const base = {'content/pages/a.json': page('a', {rows: []})}
  const ours = {'content/pages/a.json': page('a', {rows: [row('r1', 'a0')]})}
  const theirs = {'content/pages/a.json': page('a', {rows: [row('r2', 'a1')]})}
  const merged = await mergeFiles(base, ours, theirs)
  const rows = (
    merged['content/pages/a.json'] as {rows: Array<{_anchor: string}>}
  ).rows
  test.equal(
    rows.map(row => row._anchor),
    ['intro', 'intro-2']
  )
})
