import {suite} from '@alinea/suite'
import {createGitDelta} from 'alinea/core/source/GitDelta'
import {hashBlob} from 'alinea/core/source/GitUtils'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {GitSmartApi} from './GitSmartApi.js'
import {parsePack} from './gitSmart/GitSmartPack.js'
import {
  flushPkt,
  pktLine
} from './gitSmart/GitSmartProtocol.js'

const test = suite(import.meta)
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const HEAD_SHA = '1'.repeat(40)
const ROOT_TREE_SHA = '2'.repeat(40)
const REPO_TREE_SHA = '3'.repeat(40)
const CONTENT_TREE_SHA = '4'.repeat(40)
const EXISTING_BLOB_SHA = '5'.repeat(40)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'}
  })
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

async function requestBytes(init?: RequestInit) {
  if (!init?.body) return new Uint8Array(0)
  return new Uint8Array(await new Response(init.body).arrayBuffer())
}

function createApi(
  options: Partial<ConstructorParameters<typeof GitSmartApi>[0]> = {}
) {
  return new GitSmartApi({
    author: {name: 'Ben', email: 'ben@example.com'},
    owner: 'acme',
    repo: 'site',
    branch: 'main',
    authToken: 'token',
    rootDir: 'repo',
    contentDir: 'content',
    ...options
  })
}

function baseRequest(request: Partial<CommitRequest> = {}): CommitRequest {
  return {
    description: 'Update content',
    fromSha: CONTENT_TREE_SHA,
    intoSha: 'unused',
    checks: [],
    changes: [],
    ...request
  }
}

function receivePackAdvertisement(head = HEAD_SHA) {
  return concat([
    pktLine('# service=git-receive-pack\n'),
    flushPkt(),
    pktLine(
      `${head} refs/heads/main\0report-status side-band-64k ofs-delta\n`
    )
  ])
}

function uploadPackAdvertisement(head = HEAD_SHA) {
  return concat([
    pktLine('# service=git-upload-pack\n'),
    flushPkt(),
    pktLine(
      `${head} refs/heads/main\0side-band-64k ofs-delta allow-reachable-sha1-in-want\n`
    )
  ])
}

function packResult(payload: Uint8Array) {
  return new Response(
    concat([pktLine(withChannel(1, concat([encoder.encode('NAK\n'), payload]))), flushPkt()])
  )
}

function receivePackResult(status = 'ok') {
  const text =
    status === 'ok'
      ? 'unpack ok\nok refs/heads/main\n'
      : `unpack ok\nng refs/heads/main ${status}\n`
  return new Response(concat([pktLine(withChannel(1, encoder.encode(text))), flushPkt()]))
}

test('write pushes pack objects through receive-pack', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'addContent',
        path: 'pages/home.json',
        sha: 'sha-add',
        contents: '{"title":"Hello"}'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let receiveBody = new Uint8Array(0)
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    if (url === 'https://api.github.com/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: HEAD_SHA}})
    if (
      url === `https://api.github.com/repos/acme/site/contents/repo?ref=${HEAD_SHA}`
    )
      return json([{path: 'repo/content', sha: CONTENT_TREE_SHA}])
    if (url === `https://api.github.com/repos/acme/site/git/commits/${HEAD_SHA}`)
      return json({tree: {sha: ROOT_TREE_SHA}})
    if (
      url ===
      `https://api.github.com/repos/acme/site/git/trees/${ROOT_TREE_SHA}?recursive=true`
    ) {
      return json({
        sha: ROOT_TREE_SHA,
        truncated: false,
        tree: [
          {path: 'repo', mode: '040000', type: 'tree', sha: REPO_TREE_SHA},
          {
            path: 'repo/content',
            mode: '040000',
            type: 'tree',
            sha: CONTENT_TREE_SHA
          },
          {
            path: 'repo/content/existing.json',
            mode: '100644',
            type: 'blob',
            sha: EXISTING_BLOB_SHA
          }
        ]
      })
    }
    if (
      url === 'https://github.com/acme/site.git/info/refs?service=git-receive-pack'
    ) {
      return new Response(receivePackAdvertisement())
    }
    if (url === 'https://github.com/acme/site.git/git-receive-pack') {
      receiveBody = await requestBytes(init)
      return receivePackResult()
    }
    return new Response(`Unexpected ${method} ${parsed.pathname}`, {status: 500})
  }) as typeof fetch
  try {
    const result = await api.write(request)
    test.is(result.sha.length, 40)
    const bodyText = decoder.decode(receiveBody.subarray(0, 256))
    test.ok(bodyText.includes(`${HEAD_SHA} `))
    const pack = await parsePack(receiveBody.subarray(findPackOffset(receiveBody)))
    test.is(pack.filter(object => object.type === 'blob').length, 1)
    test.is(pack.filter(object => object.type === 'tree').length, 4)
    test.is(pack.filter(object => object.type === 'commit').length, 1)
    const blob = pack.find(object => object.type === 'blob')
    test.is(decoder.decode(blob!.data), '{"title":"Hello"}')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write uploads binary content through receive-pack', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'uploadFile',
        location: 'uploads/file.bin',
        url: 'https://upload.local/file.bin'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let receiveBody = new Uint8Array(0)
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    if (url === 'https://upload.local/file.bin') return new Response('uploaded')
    if (url === 'https://api.github.com/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: HEAD_SHA}})
    if (
      url === `https://api.github.com/repos/acme/site/contents/repo?ref=${HEAD_SHA}`
    )
      return json([{path: 'repo/content', sha: CONTENT_TREE_SHA}])
    if (url === `https://api.github.com/repos/acme/site/git/commits/${HEAD_SHA}`)
      return json({tree: {sha: ROOT_TREE_SHA}})
    if (
      url ===
      `https://api.github.com/repos/acme/site/git/trees/${ROOT_TREE_SHA}?recursive=true`
    ) {
      return json({
        sha: ROOT_TREE_SHA,
        truncated: false,
        tree: [
          {path: 'repo', mode: '040000', type: 'tree', sha: REPO_TREE_SHA},
          {
            path: 'repo/content',
            mode: '040000',
            type: 'tree',
            sha: CONTENT_TREE_SHA
          },
          {
            path: 'repo/content/existing.json',
            mode: '100644',
            type: 'blob',
            sha: EXISTING_BLOB_SHA
          }
        ]
      })
    }
    if (
      url === 'https://github.com/acme/site.git/info/refs?service=git-receive-pack'
    ) {
      return new Response(receivePackAdvertisement())
    }
    if (url === 'https://github.com/acme/site.git/git-receive-pack') {
      receiveBody = await requestBytes(init)
      return receivePackResult()
    }
    return new Response(`Unexpected ${url}`, {status: 500})
  }) as typeof fetch
  try {
    await api.write(request)
    const pack = await parsePack(receiveBody.subarray(findPackOffset(receiveBody)))
    const blob = pack.find(object => object.type === 'blob')
    test.is(decoder.decode(blob!.data), 'uploaded')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write maps receive-pack ref rejection to ShaMismatchError', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'addContent',
        path: 'pages/home.json',
        sha: 'sha-add',
        contents: '{"title":"Hello"}'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let refReads = 0
  globalThis.fetch = (async input => {
    const url = requestUrl(input)
      if (url === 'https://api.github.com/repos/acme/site/git/ref/heads/main') {
      refReads++
      return json({
        object: {
          sha: refReads === 1 ? HEAD_SHA : '6'.repeat(40)
        }
      })
    }
    if (
      url === `https://api.github.com/repos/acme/site/contents/repo?ref=${HEAD_SHA}`
    )
      return json([{path: 'repo/content', sha: CONTENT_TREE_SHA}])
    if (url === `https://api.github.com/repos/acme/site/git/commits/${HEAD_SHA}`)
      return json({tree: {sha: ROOT_TREE_SHA}})
    if (
      url ===
      `https://api.github.com/repos/acme/site/git/trees/${ROOT_TREE_SHA}?recursive=true`
    ) {
      return json({
        sha: ROOT_TREE_SHA,
        truncated: false,
        tree: [
          {path: 'repo', mode: '040000', type: 'tree', sha: REPO_TREE_SHA},
          {
            path: 'repo/content',
            mode: '040000',
            type: 'tree',
            sha: CONTENT_TREE_SHA
          },
          {
            path: 'repo/content/existing.json',
            mode: '100644',
            type: 'blob',
            sha: EXISTING_BLOB_SHA
          }
        ]
      })
    }
    if (
      url === 'https://github.com/acme/site.git/info/refs?service=git-receive-pack'
    ) {
      return new Response(receivePackAdvertisement())
    }
    if (url === 'https://github.com/acme/site.git/git-receive-pack') {
      return receivePackResult('non-fast-forward')
    }
    return new Response(`Unexpected ${url}`, {status: 500})
  }) as typeof fetch
  try {
    let caught: unknown
    try {
      await api.write(request)
    } catch (error) {
      caught = error
    }
    test.ok(caught instanceof ShaMismatchError)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getBlobs fetches multiple blobs through upload-pack', async () => {
  const api = createApi()
  const hello = encoder.encode('hello')
  const world = encoder.encode('world')
  const helloSha = await hashBlob(hello)
  const worldSha = await hashBlob(world)
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    if (
      url === 'https://github.com/acme/site.git/info/refs?service=git-upload-pack'
    ) {
      return new Response(uploadPackAdvertisement())
    }
    if (url === 'https://github.com/acme/site.git/git-upload-pack') {
      const body = decoder.decode(await requestBytes(init))
      test.ok(body.includes(`want ${helloSha}`))
      test.ok(body.includes(`want ${worldSha}`))
      const pack = await import('./gitSmart/GitSmartPack.js').then(mod =>
        mod.createPack([
          {type: 'blob', data: hello},
          {type: 'blob', data: world}
        ])
      )
      return packResult(pack)
    }
    return new Response(`Unexpected ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const entries = Array<[string, Uint8Array]>()
    for await (const entry of api.getBlobs([helloSha, worldSha])) {
      entries.push(entry)
    }
    test.equal(
      entries.map(([sha, value]) => [sha, decoder.decode(value)]),
      [
        [helloSha, 'hello'],
        [worldSha, 'world']
      ]
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getBlobs decodes delta objects from upload-pack', async () => {
  const api = createApi()
  const base = encoder.encode('abc123\nline2\nline3\n')
  const target = encoder.encode('abc123\nline2 updated\nline3\nline4\n')
  const targetSha = await hashBlob(target)
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async input => {
    const url = requestUrl(input)
    if (
      url === 'https://github.com/acme/site.git/info/refs?service=git-upload-pack'
    ) {
      return new Response(uploadPackAdvertisement())
    }
    if (url === 'https://github.com/acme/site.git/git-upload-pack') {
      return packResult(await createRefDeltaPack(base, target))
    }
    return new Response(`Unexpected ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const entries = Array<[string, Uint8Array]>()
    for await (const entry of api.getBlobs([targetSha])) entries.push(entry)
    test.is(entries.length, 1)
    test.is(entries[0][0], targetSha)
    test.is(decoder.decode(entries[0][1]), decoder.decode(target))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write requires an author', async () => {
  const api = createApi({author: undefined})
  await test.throws(
    () => api.write(baseRequest()),
    'GitSmartApi requires an author'
  )
})

function concat(parts: Array<Uint8Array>) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function withChannel(channel: number, payload: Uint8Array) {
  const out = new Uint8Array(payload.length + 1)
  out[0] = channel
  out.set(payload, 1)
  return out
}

async function createRefDeltaPack(base: Uint8Array, target: Uint8Array) {
  const {Blob, CompressionStream, Response} = await import('@alinea/iso')
  const {hexToBytes} = await import('alinea/core/source/Utils')
  const baseSha = await hashBlob(base)
  const delta = createGitDelta(base, target)
  const header = new Uint8Array(12)
  header.set(encoder.encode('PACK'), 0)
  new DataView(header.buffer).setUint32(4, 2, false)
  new DataView(header.buffer).setUint32(8, 2, false)
  const baseEntry = concat([
    encodeHeader(3, base.length),
    await compressed(base, Blob, CompressionStream, Response)
  ])
  const deltaEntry = concat([
    encodeHeader(7, delta.length),
    hexToBytes(baseSha),
    await compressed(delta, Blob, CompressionStream, Response)
  ])
  const payload = concat([header, baseEntry, deltaEntry])
  const {sha1Bytes} = await import('alinea/core/source/Utils')
  return concat([payload, await sha1Bytes(payload)])
}

function encodeHeader(type: number, size: number) {
  const bytes = Array<number>()
  let n = size >>> 4
  let first = ((type & 0x07) << 4) | (size & 0x0f)
  if (n !== 0) first |= 0x80
  bytes.push(first)
  while (n !== 0) {
    let next = n & 0x7f
    n >>>= 7
    if (n !== 0) next |= 0x80
    bytes.push(next)
  }
  return Uint8Array.from(bytes)
}

async function compressed(
  data: Uint8Array,
  BlobClass: any,
  Compression: any,
  ResponseClass: any
) {
  const blob = new BlobClass([data])
  const response = new ResponseClass(
    blob.stream().pipeThrough(new Compression('deflate'))
  )
  return new Uint8Array(await response.arrayBuffer())
}

function findPackOffset(bytes: Uint8Array) {
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x41 &&
      bytes[i + 2] === 0x43 &&
      bytes[i + 3] === 0x4b
    ) {
      return i
    }
  }
  throw new Error('Missing PACK marker')
}
