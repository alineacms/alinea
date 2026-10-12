import {suite} from '@alinea/suite'
import {applyFilePatch, createFilePatch} from './FilePatch.js'

const test = suite(import.meta)

test('roundtrip', async () => {
  const cases = [
    ['hello\nworld\n', 'hello\nworld\n'],
    ['alpha beta gamma delta', 'alpha BETA and GAMMA delta'],
    ['a\n1\n2\n3\nb\n', 'z\n1\nX\n3\nY\n'],
    ['hello 👋\nmañana\n', 'hello 👋\nmanana\n✅\n']
  ]
  for (const [base, next] of cases) {
    const patch = await createFilePatch(base, next)
    test.is(await applyFilePatch(base, patch), next)
  }
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
