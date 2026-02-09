import {suite} from '@alinea/suite'
import {applyFilePatch, createFilePatch} from './FilePatch.js'

const test = suite(import.meta)

test('roundtrip no change', async () => {
  const base = 'hello\nworld\n'
  const patch = await createFilePatch(base, base)
  const updated = await applyFilePatch(base, patch)
  test.is(updated, base)
})

test('roundtrip with middle replacement', async () => {
  const base = 'alpha beta gamma delta'
  const next = 'alpha BETA and GAMMA delta'
  const patch = await createFilePatch(base, next)
  const updated = await applyFilePatch(base, patch)
  test.is(updated, next)
})

test('roundtrip with scattered edits', async () => {
  const base = 'a\n1\n2\n3\nb\n'
  const next = 'z\n1\nX\n3\nY\n'
  const patch = await createFilePatch(base, next)
  const updated = await applyFilePatch(base, patch)
  test.is(updated, next)
})

test('roundtrip unicode', async () => {
  const base = 'hello 👋\nmañana\n'
  const next = 'hello 👋\nmanana\n✅\n'
  const patch = await createFilePatch(base, next)
  const updated = await applyFilePatch(base, patch)
  test.is(updated, next)
})

test('rejects patch on wrong base', async () => {
  const patch = await createFilePatch('aaa', 'bbb')
  await test.throws(
    () => applyFilePatch('aac', patch),
    'Patch does not match base'
  )
})

test('rejects patch with mismatching final hash', async () => {
  const base = 'hello'
  const next = 'hello world'
  const patch = await createFilePatch(base, next)
  patch[patch.length - 1] ^= 0xff
  await test.throws(
    () => applyFilePatch(base, patch),
    'Patched content hash mismatch'
  )
})
