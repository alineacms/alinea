import {Entry} from '#/core/Entry.js'
import {Query} from '#/index.js'
import {Doc, Playground, bodyFor, remoteDocs} from './session.js'

const session = await Playground.open()
// Start with a small, explorable tree.
await session.seedRemote([
  {id: 'home', title: 'Home', body: bodyFor(1, 30), score: 10, flag: true},
  {id: 'guides', title: 'Guides', body: bodyFor(2, 30), score: 8, flag: true, parentPaths: ['home']},
  {id: 'recipes', title: 'Recipes', body: bodyFor(3, 30), score: 9, flag: false, parentPaths: ['home']},
  {id: 'cookies', title: 'Cookies', body: bodyFor(4, 40), score: 7, flag: true, parentPaths: ['home', 'recipes']},
  {id: 'cake', title: 'Cake', body: bodyFor(5, 40), score: 6, flag: false, parentPaths: ['home', 'recipes']}
])
await session.store.syncWith(session.remote)

const root = new URL('.', import.meta.url).pathname
let seedCounter = 0

async function status() {
  return Response.json({
    entries: await session.store.count({}),
    revision: (await session.store.sha).slice(0, 8),
    databaseBytes: await session.databaseBytes(),
    remoteFiles: session.remoteDocs.size
  })
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 4123),  async fetch(request) {
    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/status' && request.method === 'GET')
        return status()
      if (url.pathname === '/api/entries' && request.method === 'GET') {
        const search = url.searchParams.get('search') ?? undefined
        const take = Number(url.searchParams.get('take') ?? 20)
        const skip = Number(url.searchParams.get('skip') ?? 0)
        const t = performance.now()
        const rows = await session.store.find({
          type: Doc,
          search,
          skip,
          take,
          orderBy: {asc: Doc.title},
          select: {id: Entry.id, title: Doc.title, score: Doc.score, status: Entry.status, parentId: Entry.parentId}
        })
        return Response.json({rows, ms: Math.round((performance.now() - t) * 10) / 10})
      }
      if (url.pathname === '/api/tree' && request.method === 'GET') {
        const t = performance.now()
        const rows = await session.store.find({
          type: Doc,
          select: {id: Entry.id, title: Doc.title, parentId: Entry.parentId, status: Entry.status}
        })
        return Response.json({rows, ms: Math.round((performance.now() - t) * 10) / 10})
      }
      if (url.pathname === '/api/relations' && request.method === 'GET') {
        const id = url.searchParams.get('id')!
        const t = performance.now()
        const row = await session.store.get({
          id,
          select: {
            id: Entry.id,
            title: Doc.title,
            parent: Query.parent({select: Entry.id}),
            children: Query.children({select: Entry.id}),
            siblings: Query.siblings({select: Entry.id})
          }
        })
        return Response.json({row, ms: Math.round((performance.now() - t) * 10) / 10})
      }
      if (url.pathname === '/api/seed' && request.method === 'POST') {
        const {count = 1000} = await request.json()
        seedCounter += 1
        const offset = seedCounter * 1000000
        let t = performance.now()
        await session.seedRemote([
          ...session.remoteDocs.values(),
          ...remoteDocs(count, offset)
        ])
        const buildMs = performance.now() - t
        t = performance.now()
        await session.store.syncWith(session.remote)
        const syncMs = performance.now() - t
        const statusResponse = await (await status()).json()
        return Response.json({
          ...statusResponse,
          buildMs: Math.round(buildMs),
          syncMs: Math.round(syncMs)
        })
      }
      if (url.pathname === '/api/remote-edit' && request.method === 'POST') {
        const body = await request.json()
        const existing = session.remoteDocs.get(body.id)
        if (!existing) return Response.json({error: 'unknown id'}, {status: 404})
        await session.editRemote({...existing, ...body.set})
        return Response.json({ok: true, remoteFiles: session.remoteDocs.size})
      }
      if (url.pathname === '/api/remote-add' && request.method === 'POST') {
        const body = await request.json()
        const id = body.id ?? `doc-${Date.now().toString(36)}`
        await session.editRemote({
          id,
          title: body.title ?? id,
          body: bodyFor(id.length * 7919 + 13, 60),
          score: Math.floor(Math.random() * 100),
          flag: Math.random() > 0.5,
          parentPaths: body.parentPaths
        })
        return Response.json({ok: true, id, remoteFiles: session.remoteDocs.size})
      }
      if (url.pathname === '/api/remote-remove' && request.method === 'POST') {
        const {id} = await request.json()
        await session.removeRemote(id)
        return Response.json({ok: true, remoteFiles: session.remoteDocs.size})
      }
      if (url.pathname === '/api/sync' && request.method === 'POST') {
        const t = performance.now()
        await session.store.syncWith(session.remote)
        const ms = performance.now() - t
        const statusResponse = await (await status()).json()
        return Response.json({...statusResponse, syncMs: Math.round(ms * 10) / 10})
      }
      if (url.pathname === '/api/mutate' && request.method === 'POST') {
        const {op, ...args} = await request.json()
        const t = performance.now()
        const result = await session.store.mutate([{op, locale: null, ...args}])
        const ms = performance.now() - t
        const statusResponse = await (await status()).json()
        return Response.json({...statusResponse, ms: Math.round(ms * 10) / 10, sha: result.sha.slice(0, 8)})
      }
      if (url.pathname === '/api/reset' && request.method === 'POST') {
        await session.seedRemote([])
        await session.store.syncWith(session.remote)
        return status()
      }
      const file = Bun.file(root + 'public' + (url.pathname === '/' ? '/index.html' : url.pathname))
      if (await file.exists()) return new Response(file)
      return new Response('Not found', {status: 404})
    } catch (error: any) {
      return Response.json({error: String(error?.message ?? error)}, {status: 500})
    }
  }
})

console.log(`Playground running at http://localhost:${server.port}`)
