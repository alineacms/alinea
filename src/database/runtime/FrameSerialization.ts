import {assert} from '#/core/util/Assert.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {ReadonlyTree as SourceTree} from '#/core/source/Tree.js'
import {decode, encode, type CBORValue} from 'microcbor'
import type {
  RuntimeReferenceFrame,
  RuntimeReferenceTarget,
  RuntimeSearchFrame,
  RuntimeSourceDataFrame
} from './Model.js'

export interface RuntimeSourceTreeFrame {
  tree: ReadonlyTree
  entries: ReadonlyMap<string, number>
}

export function encodeRuntimeSourceDataFrame(
  frame: RuntimeSourceDataFrame
): Uint8Array {
  return encode([
    frame.filePath,
    frame.fileHash,
    (frame.dataDefaults ?? null) as CBORValue,
    frame.contents
  ])
}

export function decodeRuntimeSourceDataFrame(
  contents: Uint8Array
): RuntimeSourceDataFrame {
  const value = decode(contents)
  assert(Array.isArray(value), 'Invalid runtime source data frame')
  const [filePath, fileHash, dataDefaults, source] = value
  assert(typeof filePath === 'string', 'Invalid runtime source file path')
  assert(typeof fileHash === 'string', 'Invalid runtime source file hash')
  assert(
    dataDefaults == null ||
      (typeof dataDefaults === 'object' && !Array.isArray(dataDefaults)),
    'Invalid runtime source data defaults'
  )
  assert(source instanceof Uint8Array, 'Invalid runtime source contents')
  return {
    filePath,
    fileHash,
    dataDefaults: (dataDefaults ?? undefined) as
      | Readonly<Record<string, unknown>>
      | undefined,
    contents: source
  }
}

export function encodeRuntimeSearchFrame(
  frame: RuntimeSearchFrame
): Uint8Array {
  return encode([frame.title, frame.searchableText])
}

export function decodeRuntimeSearchFrame(
  contents: Uint8Array
): RuntimeSearchFrame {
  const value = decode(contents)
  assert(Array.isArray(value), 'Invalid runtime search frame')
  const [title, searchableText] = value
  assert(typeof title === 'string', 'Invalid runtime search title')
  assert(typeof searchableText === 'string', 'Invalid runtime searchable text')
  return {title, searchableText}
}

export function encodeRuntimeReferenceFrame(
  frame: RuntimeReferenceFrame
): Uint8Array {
  return encode([
    frame.sourceFilePath,
    frame.references.map(reference => [
      reference.targetId,
      reference.fieldPath,
      reference.fieldLabel ?? null,
      reference.linkId ?? null,
      reference.linkType ?? null
    ])
  ])
}

export function decodeRuntimeReferenceFrame(
  contents: Uint8Array
): RuntimeReferenceFrame {
  const value = decode(contents)
  assert(Array.isArray(value), 'Invalid runtime reference frame')
  const [sourceFilePath, references] = value
  assert(
    typeof sourceFilePath === 'string',
    'Invalid runtime reference source path'
  )
  assert(Array.isArray(references), 'Invalid runtime references')
  return {
    sourceFilePath,
    references: references.map(decodeReference)
  }
}

export function encodeRuntimeSourceTree(
  tree: ReadonlyTree,
  entries: ReadonlyMap<string, number>
): Uint8Array {
  const flat = tree.flat()
  return encode([
    flat.sha,
    flat.tree.map(entry => [entry.path, entry.sha, entry.mode]),
    [...entries]
  ])
}

export function decodeRuntimeSourceTree(
  contents: Uint8Array
): RuntimeSourceTreeFrame {
  const value = decode(contents)
  assert(Array.isArray(value), 'Invalid runtime source tree')
  const [sha, entries, represented] = value
  assert(typeof sha === 'string', 'Invalid runtime source tree sha')
  assert(Array.isArray(entries), 'Invalid runtime source tree entries')
  assert(Array.isArray(represented), 'Invalid runtime source entry map')
  return {
    tree: SourceTree.fromFlat({
      sha,
      tree: entries.map(value => {
        assert(Array.isArray(value), 'Invalid runtime source tree entry')
        const [path, entrySha, mode] = value
        assert(typeof path === 'string', 'Invalid runtime source tree path')
        assert(typeof entrySha === 'string', 'Invalid runtime source entry sha')
        assert(typeof mode === 'string', 'Invalid runtime source entry mode')
        return {
          type: mode === '040000' ? 'tree' : 'blob',
          path,
          sha: entrySha,
          mode
        }
      })
    }),
    entries: new Map(
      represented.map(value => {
        assert(Array.isArray(value), 'Invalid runtime source tree entry')
        const [entrySha, position] = value
        assert(typeof entrySha === 'string', 'Invalid runtime source map sha')
        assert(typeof position === 'number', 'Invalid runtime source position')
        return [entrySha, position] as const
      })
    )
  }
}

function decodeReference(value: unknown): RuntimeReferenceTarget {
  assert(Array.isArray(value), 'Invalid runtime reference')
  const [targetId, fieldPath, fieldLabel, linkId, linkType] = value
  assert(typeof targetId === 'string', 'Invalid runtime reference target')
  assert(typeof fieldPath === 'string', 'Invalid runtime reference field path')
  assert(
    fieldLabel == null || typeof fieldLabel === 'string',
    'Invalid runtime reference field label'
  )
  assert(
    linkId == null || typeof linkId === 'string',
    'Invalid runtime reference link id'
  )
  assert(
    linkType == null ||
      linkType === 'entry' ||
      linkType === 'image' ||
      linkType === 'file',
    'Invalid runtime reference link type'
  )
  return {
    targetId,
    fieldPath,
    fieldLabel: fieldLabel ?? undefined,
    linkId: linkId ?? undefined,
    linkType: linkType ?? undefined
  }
}
