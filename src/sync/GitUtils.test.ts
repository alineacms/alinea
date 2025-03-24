import {execSync} from 'node:child_process'
import {suite} from '@alinea/suite'
import {
  hashBlob,
  hashTree,
  parseTreeEntries,
  serializeTreeEntries
} from './GitUtils.ts'
import type {Tree} from './Tree.ts'
import {concatUint8Arrays, hexToBytes} from './Utils.ts'
import {sha1Hash} from './Utils.ts'

const test = suite(import.meta)

const sampleTree: Tree = {
  sha: 'e7ed88bc0c4055fd92561d514834',
  entries: [
    {
      mode: '100644',
      sha: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
      name: 'file.txt'
    }
  ]
}

const complexTree: Tree = {
  sha: 'e7ed88bc0c4055fd92561d514834',
  entries: [
    {
      mode: '100644',
      name: 'a.txt',
      sha: 'dffd6021bb2bd5b0af676290809ec3a53191dd81'
    },
    {
      mode: '040000',
      name: 'subdir',
      sha: 'd8329fc1cc938780ffdd9f94e0d364e0ea74f579'
    }
  ]
}

test('computes raw SHA-1 for an empty string', async () => {
  const data = new TextEncoder().encode('')
  const ourHash = await sha1Hash(data)
  test.is(ourHash, 'da39a3ee5e6b4b0d3255bfef95601890afd80709')
})

test('computes raw SHA-1 for "hello\\n"', async () => {
  const data = new TextEncoder().encode('hello\n')
  const ourHash = await sha1Hash(data)
  test.is(ourHash, 'f572d396fae9206628714fb2ce00f72e94f2258f')
})

test('matches Git hash for an empty blob', async () => {
  const data = new Uint8Array(0)
  const ourHash = await hashBlob(data)
  const gitHash = git('hash-object -t blob --stdin', data)
  test.is(ourHash, gitHash)
})

test('matches Git hash for "hello\\n" blob', async () => {
  const data = new TextEncoder().encode('hello\n')
  const ourHash = await hashBlob(data)
  const gitHash = git('hash-object -t blob --stdin', data)
  test.is(ourHash, gitHash)
})

test('matches Git tree hash for a single-entry tree', async () => {
  const serialized = serializeTreeEntries(sampleTree.entries)
  const ourHash = await hashTree(serialized)

  // Use Git to hash the same tree content
  // Format: "100644 file.txt\0<20-byte-sha1>"
  const modeName = new TextEncoder().encode('100644 file.txt\0')
  const sha1Bytes = hexToBytes('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  const content = concatUint8Arrays([modeName, sha1Bytes])
  const gitHash = git('hash-object -t tree --stdin', content)

  test.is(ourHash, gitHash)
})

test('matches Git tree hash for a multi-entry tree', async () => {
  const serialized = serializeTreeEntries(complexTree.entries)
  const ourHash = await hashTree(serialized)
  const gitHash = git('hash-object -t tree --stdin', serialized)

  test.is(ourHash, gitHash)
})

test('parses a single-entry tree matching Git serialization', async () => {
  // Serialize our tree
  const serialized = serializeTreeEntries(sampleTree.entries)
  const parsed = parseTreeEntries(serialized)

  // Verify parsing matches original input
  test.equal(parsed, sampleTree.entries)

  // Ensure serialization matches Git by hashing
  const ourHash = await hashTree(serialized)
  const gitHash = git('hash-object -t tree --stdin', serialized)
  test.is(ourHash, gitHash)
})

test('parses a multi-entry tree matching Git serialization', async () => {
  const serialized = serializeTreeEntries(complexTree.entries)
  const parsed = parseTreeEntries(serialized)

  test.equal(parsed, complexTree.entries)

  const ourHash = await hashTree(serialized)
  const gitHash = git('hash-object -t tree --stdin', serialized)
  test.is(ourHash, gitHash)
})

test('sorting', async () => {
  const directories = ['foo-bar', 'foo/bar', 'fooXbar']
  const tree = directories.map(name => ({
    sha: '0'.repeat(40),
    name,
    mode: '040000'
  }))
  const serialized = serializeTreeEntries(tree)
  const parsed = parseTreeEntries(serialized)
  test.equal(parsed, tree)
})

function git(command: string, input?: Uint8Array): string {
  try {
    const result = execSync(`git ${command}`, {
      input: input ? Buffer.from(input) : undefined,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return result.trim()
  } catch (error) {
    throw new Error(`Git command failed: ${command}\n${error}`)
  }
}
