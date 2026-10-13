/**
 * The content the repository starts with, created through an entry store so
 * the files are exactly what Alinea writes.
 */
import {createId} from '#/core/Id.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {accumulate} from '#/core/util/Async.js'
import {EntryStore} from '#/database/EntryStore.js'
import {labConfig} from '../shared/schema.js'
import {github} from './github.js'

export const pages = [
  {key: 'home', title: 'Home', body: 'Welcome to the lab'},
  {key: 'about', title: 'About', body: 'Content lives in git'},
  {key: 'blog', title: 'Blog', body: 'News from the lab'}
]

export const pageIds: Record<string, string> = {}

export async function seedRepository() {
  github.reset()
  const config = labConfig(1)
  const source = new MemorySource()
  const store = await EntryStore.memory(config, source)
  await store.mutate(
    pages.map(page => {
      const id = createId()
      pageIds[page.key] = id
      return {
        op: 'create' as const,
        type: 'Page',
        id,
        locale: null,
        workspace: 'main',
        root: 'pages',
        status: 'published' as const,
        data: {title: page.title, path: page.key, body: page.body}
      }
    })
  )
  const tree = await source.getTree()
  const index = tree.index()
  const blobs = new Map(await accumulate(source.getBlobs([...index.values()])))
  await store.close()
  return github.commit(
    {
      fromSha: '',
      changes: [...index].map(([path, sha]) => ({
        op: 'add' as const,
        path,
        sha,
        contents: blobs.get(sha)
      }))
    },
    'Initial content',
    'developer',
    1
  )
}

/** The file of a published entry on the branch. */
export function fileOf(id: string): string | undefined {
  for (const {path} of github.files()) {
    const text = github.read(path)
    if (!text) continue
    try {
      if (JSON.parse(text)._id === id && !path.includes('.draft')) return path
    } catch {}
  }
}

/** A developer edits the title of a page in the file and pushes it. */
export async function pushTitle(id: string, title: string, message: string) {
  const path = fileOf(id)
  if (!path) throw new Error(`No file for ${id}`)
  const record = JSON.parse(github.read(path)!)
  record.title = title
  return github.push(
    [{path, contents: `${JSON.stringify(record, null, 2)}\n`}],
    message,
    'developer'
  )
}
