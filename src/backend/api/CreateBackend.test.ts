import {suite} from '@alinea/suite'
import {createRemote} from './CreateBackend.js'

const test = suite(import.meta)

test('createRemote routes write/getBlobs to later smart implementation and keeps history on github implementation', async () => {
  let writes = 0
  let revisions = 0
  const remote = createRemote(
    {
      revisions: async () => {
        revisions++
        return []
      },
      revisionData: async () => undefined,
      getTreeIfDifferent: async () => undefined
    },
    {
      write: async () => {
        writes++
        return {sha: 'next'}
      },
      getBlobs: async function* () {
        yield ['a'.repeat(40), new Uint8Array([1])]
      }
    }
  )
  await remote.write({} as any)
  const blobs = Array<[string, Uint8Array]>()
  for await (const blob of remote.getBlobs(['a'.repeat(40)])) blobs.push(blob)
  await remote.revisions('x')
  test.is(writes, 1)
  test.is(revisions, 1)
  test.is(blobs.length, 1)
})
