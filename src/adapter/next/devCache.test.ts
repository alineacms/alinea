import {expect, test} from 'bun:test'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {developmentRevision} from './devCache.js'

test('the development revision changes with the database file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-dev-revision-'))
  try {
    const file = join(dir, 'alinea.db')
    expect(developmentRevision(file)).toBeUndefined()
    await writeFile(file, 'first')
    const first = developmentRevision(file)
    expect(first).toBeString()
    expect(developmentRevision(file)).toBe(first)
    await writeFile(file, 'second revision')
    expect(developmentRevision(file)).not.toBe(first)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
