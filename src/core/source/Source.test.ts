import {suite} from '@alinea/suite'
import {accumulate} from '../util/Async.js'
import type {Change} from './Change.js'
import {hashBlob} from './GitUtils.js'
import {MemorySource} from './MemorySource.js'
import {
  bundleContents,
  latestTree,
  type RemoteSource,
  SourceTransaction
} from './Source.js'
import type {ReadonlyTree} from './Tree.js'
import {UnknownTreeError} from './UnknownTreeError.js'

const test = suite(import.meta)
const encoder = new TextEncoder()

test('compiles incremental changes against a previous tree', async () => {
  const source = new MemorySource()
  const initial = await source.getTree()
  const transaction = new SourceTransaction(source, initial)
  transaction.add('one.txt', encoder.encode('one'))
  const first = await transaction.compile(initial)

  transaction.add('two.txt', encoder.encode('two'))
  const second = await transaction.compile(first.into)

  test.is(second.from, first.into)
  test.equal(
    second.changes.map(change => change.path),
    ['two.txt']
  )

  const complete = await transaction.compile()
  test.is(complete.from, initial)
  test.equal(
    complete.changes.map(change => change.path),
    ['one.txt', 'two.txt']
  )
})

/** A remote over a source that tells the changes since the trees it had. */
function changesRemote(source: MemorySource) {
  const trees = new Map<string, ReadonlyTree>()
  const requests = {trees: 0, changes: 0, blobs: 0}
  const remote: RemoteSource = {
    async getTreeIfDifferent(sha) {
      requests.trees++
      return source.getTreeIfDifferent(sha)
    },
    async getChanges(sha) {
      requests.changes++
      const latest = await source.getTree()
      trees.set(latest.sha, latest)
      if (latest.sha === sha) return undefined
      const known = trees.get(sha)
      if (!known) throw new UnknownTreeError(sha)
      const batch = await bundleContents(source, known.diff(latest))
      return {...batch, intoSha: latest.sha}
    },
    getBlobs(shas) {
      requests.blobs++
      return source.getBlobs(shas)
    }
  }
  return {remote, requests, trees}
}

async function write(source: MemorySource, path: string, text: string) {
  const tree = await source.getTree()
  const contents = encoder.encode(text)
  await source.applyChanges({
    fromSha: tree.sha,
    changes: [{op: 'add', path, sha: await hashBlob(contents), contents}]
  })
}

test('the latest tree is built from the changes a remote sends', async () => {
  const source = new MemorySource()
  await write(source, 'pages/about.json', 'about')
  await write(source, 'pages/contact.json', 'contact')
  const {remote, requests} = changesRemote(source)
  const from = await source.getTree()
  test.is(await latestTree(remote, from), undefined)
  await write(source, 'pages/about.json', 'about us')
  const latest = await latestTree(remote, from)
  test.is(latest!.tree.sha, (await source.getTree()).sha)
  const shas = from.diff(latest!.tree).changes.map(change => change.sha)
  const blobs = await accumulate(latest!.source.getBlobs(shas))
  test.equal(
    blobs.map(([, blob]) => new TextDecoder().decode(blob)),
    ['about us']
  )
  test.equal(requests, {trees: 0, changes: 2, blobs: 0})
})

test('a remote that does not know the tree sends the whole tree', async () => {
  const source = new MemorySource()
  await write(source, 'pages/about.json', 'about')
  const {remote, requests} = changesRemote(source)
  const from = await source.getTree()
  await write(source, 'pages/about.json', 'about us')
  const latest = await latestTree(remote, from)
  test.is(latest!.tree, await source.getTree())
  test.equal(requests, {trees: 1, changes: 1, blobs: 0})
})

test('changes that do not lead to the latest tree are not trusted', async () => {
  const source = new MemorySource()
  await write(source, 'pages/about.json', 'about')
  const from = await source.getTree()
  const about = from.getLeaf('pages/about.json').sha
  await write(source, 'pages/about.json', 'about us')
  const intoSha = (await source.getTree()).sha
  const wrong: Array<Array<Change>> = [
    [],
    [{op: 'delete', path: 'pages/about.json', sha: intoSha}],
    [{op: 'add', path: 'pages/other.json', sha: about}]
  ]
  for (const changes of wrong) {
    let trees = 0
    const remote: RemoteSource = {
      async getTreeIfDifferent(sha) {
        trees++
        return source.getTreeIfDifferent(sha)
      },
      async getChanges(fromSha) {
        return {fromSha, intoSha, changes}
      },
      getBlobs: shas => source.getBlobs(shas)
    }
    const latest = await latestTree(remote, from)
    test.is(latest!.tree, await source.getTree())
    test.is(trees, 1)
  }
})
