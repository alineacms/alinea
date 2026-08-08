import {suite} from '@alinea/suite'
import {hashObject} from 'alinea/core/source/GitUtils'
import {
  hashCommitObject,
  serializeCommitObject,
  type GitSignature
} from './GitSmartObjects.js'

const test = suite(import.meta)
const decoder = new TextDecoder()

const author: GitSignature = {name: 'Ben', email: 'ben@example.com'}
const committer: GitSignature = {name: 'CI', email: 'ci@example.com'}
const date = new Date('2024-01-01T00:00:00.000Z')

test('serializeCommitObject renders author and committer headers', () => {
  const bytes = serializeCommitObject({
    tree: 'a'.repeat(40),
    parent: 'b'.repeat(40),
    message: 'Hello',
    author,
    committer,
    date
  })
  const text = decoder.decode(bytes)
  test.ok(text.includes(`tree ${'a'.repeat(40)}`))
  test.ok(text.includes(`parent ${'b'.repeat(40)}`))
  test.ok(text.includes('author Ben <ben@example.com> 1704067200 +0000'))
  test.ok(text.includes('committer CI <ci@example.com> 1704067200 +0000'))
  test.ok(text.endsWith('\nHello') || text.endsWith('Hello'))
})

test('hashCommitObject matches generic git object hash', async () => {
  const commit = {
    tree: 'c'.repeat(40),
    parent: 'd'.repeat(40),
    message: 'Ship it',
    author,
    committer,
    date
  }
  const serialized = serializeCommitObject(commit)
  const specific = await hashCommitObject(commit)
  const generic = await hashObject('commit', serialized)
  test.is(specific, generic)
  test.is(specific.length, 40)
})

test('serializeCommitObject uses author as default committer', () => {
  const bytes = serializeCommitObject({
    tree: 'e'.repeat(40),
    parent: 'f'.repeat(40),
    message: 'Default committer',
    author,
    date
  })
  const text = decoder.decode(bytes)
  test.ok(text.includes('author Ben <ben@example.com> 1704067200 +0000'))
  test.ok(text.includes('committer Ben <ben@example.com> 1704067200 +0000'))
})
