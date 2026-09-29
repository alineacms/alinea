import {expect, mock, test} from 'bun:test'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {cachedResolve, developmentRevision} from './devCache.js'

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

test('there is no development revision without a database file', () => {
  expect(developmentRevision('')).toBeUndefined()
})

test('queries are answered directly outside the Next.js runtime', async () => {
  const resolve = mock(async () => [{title: 'Answered'}])
  expect(await cachedResolve(['rev'], '{}', resolve)).toEqual([
    {title: 'Answered'}
  ])
  expect(resolve).toHaveBeenCalledTimes(1)
})

test('a failing query is not asked again', async () => {
  const resolve = mock(async () => {
    throw new Error('Invalid query')
  })
  await expect(cachedResolve(['rev'], '{}', resolve)).rejects.toThrow(
    'Invalid query'
  )
  expect(resolve).toHaveBeenCalledTimes(1)
})
