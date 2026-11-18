import {MemorySource} from '#/core/source/MemorySource.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {treeObjects} from '#/core/source/TreeObjects.js'
import {MemoryObjectStore} from '@alinea/graft'
import {readPack} from '@alinea/graft/git'
import {suite} from '@alinea/suite'
import {DevPacks} from './DevPacks.js'

const test = suite(import.meta)
const encoder = new TextEncoder()

async function source(files: Record<string, string>) {
  const memory = new MemorySource()
  const changes = await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      const contents = encoder.encode(text)
      return {op: 'add' as const, path, sha: await hashBlob(contents), contents}
    })
  )
  await memory.applyChanges({fromSha: (await memory.getTree()).sha, changes})
  return memory
}

async function edit(memory: MemorySource, path: string, text: string) {
  const contents = encoder.encode(text)
  const sha = await hashBlob(contents)
  const fromSha = (await memory.getTree()).sha
  await memory.applyChanges({
    fromSha,
    changes: [{op: 'add', path, sha, contents}]
  })
  return sha
}

const files = Object.fromEntries(
  Array.from({length: 50}, (_, i) => [
    `pages/page-${i}.json`,
    JSON.stringify({title: `Page ${i}`, body: 'x'.repeat(2000)})
  ])
)

test('names the head when asked without have', async () => {
  const memory = await source(files)
  const packs = new DevPacks(memory)
  test.equal(await packs.getPack(), {sha: (await memory.getTree()).sha})
})

test('answers nothing for a dashboard that is current', async () => {
  const memory = await source(files)
  const packs = new DevPacks(memory)
  test.is(await packs.getPack((await memory.getTree()).sha), undefined)
})

test('sends only what changed since a tree it served', async () => {
  const memory = await source(files)
  const packs = new DevPacks(memory)
  const before = await memory.getTree()
  const have = before.sha
  // The dashboard's first sync fetched this tree through the Tree action,
  // and keeps its directories as objects
  await packs.getTreeIfDifferent('')
  const held = new MemoryObjectStore()
  await held.put(treeObjects(before))
  const blob = await edit(memory, 'pages/page-3.json', '{"title":"Edited"}')
  const pack = await packs.getPack(have)
  test.is(pack?.sha, (await memory.getTree()).sha)
  const objects = await readPack(pack!.pack!, {bases: held})
  test.equal(
    objects.filter(object => object.type === 'blob').map(object => object.sha),
    [blob]
  )
  // The blob and the two trees on its path
  test.is(objects.length, 3)
  test.ok(pack!.pack!.length < 500)
})

test('sends everything for a tree it never served', async () => {
  const memory = await source(files)
  const packs = new DevPacks(memory)
  const pack = await packs.getPack('0'.repeat(40))
  const objects = await readPack(pack!.pack!)
  test.is(objects.filter(object => object.type === 'blob').length, 50)
})
