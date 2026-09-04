import {expect, test} from 'bun:test'
import {
  decodeRuntimeReferenceFrame,
  decodeRuntimeSearchFrame,
  decodeRuntimeSourceTree,
  encodeRuntimeReferenceFrame,
  encodeRuntimeSearchFrame,
  encodeRuntimeSourceTree
} from './FrameSerialization.js'
import {ReadonlyTree} from '#/core/source/Tree.js'

test('round trips compact search frames', () => {
  const frame = {title: 'Hello', searchableText: 'Hello world'}
  expect(decodeRuntimeSearchFrame(encodeRuntimeSearchFrame(frame))).toEqual(
    frame
  )
})

test('round trips compact reference frames', () => {
  const frame = {
    sourceFilePath: 'pages/home.json',
    references: [
      {
        targetId: 'target',
        fieldPath: 'blocks.0.image',
        fieldLabel: 'Image',
        linkId: 'link',
        linkType: 'image' as const
      }
    ]
  }
  expect(
    decodeRuntimeReferenceFrame(encodeRuntimeReferenceFrame(frame))
  ).toEqual(frame)
})

test('round trips compact source trees', () => {
  const tree = new ReadonlyTree({
    sha: 'root',
    entries: [
      {
        name: 'pages',
        sha: 'directory',
        mode: '040000',
        entries: [{name: 'home.json', sha: 'blob', mode: '100644'}]
      }
    ]
  })
  const entries = new Map([['blob', 0]])
  const decoded = decodeRuntimeSourceTree(
    encodeRuntimeSourceTree(tree, entries)
  )
  expect(decoded.tree.toJSON()).toEqual(tree.toJSON())
  expect(decoded.entries).toEqual(entries)
})
