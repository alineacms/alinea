import type {EntryStatus} from '../Entry.js'
import type {FlatTree} from '../source/Tree.js'
import type {EntryManifest} from './EntryManifest.js'
import {ENTRY_SNAPSHOT_VERSION, type EntrySnapshot} from './EntrySnapshot.js'
import {createEntrySnapshotIndexes} from './EntrySnapshotIndex.js'
import type {
  EntryLanguageRow,
  EntryNodeRow,
  EntryRowStore,
  EntryVersionRow
} from './EntryRows.js'

export interface CompactEntrySnapshot {
  v: typeof ENTRY_SNAPSHOT_VERSION
  g: string
  m: EntryManifest
  t: FlatTree
  r: CompactEntryRows
  s?: EntrySnapshot['search']
}

export interface CompactEntryRows {
  v: Array<CompactEntryVersionRow>
  l: Array<CompactEntryLanguageRow>
  n: Array<CompactEntryNodeRow>
}

type PackedStatus = 0 | 1 | 2
type PackedColumn = string
type PackedJson =
  | null
  | boolean
  | number
  | string
  | Array<PackedJson>
  | {o: Array<[key: string, value: PackedJson]>}

export interface PackedDataRows {
  k: Array<Array<string>>
  i: string
  v: Array<Array<PackedJson>>
}

export interface PackedEntrySnapshot {
  p: 1
  v: typeof ENTRY_SNAPSHOT_VERSION
  g: string
  m: EntryManifest
  t: PackedFlatTree
  d: Array<string>
  r: PackedEntryRows
  s?: EntrySnapshot['search']
}

export interface PackedFlatTree {
  s: string
  p: string
  m: string
  h: string
  y: string
}

export interface PackedEntryRows {
  v: [
    rowId: PackedColumn,
    versionId: PackedColumn,
    nodeId: PackedColumn,
    languageId: PackedColumn,
    id: PackedColumn,
    type: PackedColumn,
    index: PackedColumn,
    title: PackedColumn,
    searchableText: PackedColumn,
    seeded: PackedColumn,
    rowHash: PackedColumn,
    fileHash: PackedColumn,
    data: PackedDataRows,
    status: PackedColumn,
    locale: PackedColumn,
    workspace: PackedColumn,
    root: PackedColumn,
    path: PackedColumn,
    parentDir: PackedColumn,
    childrenDir: PackedColumn,
    filePath: PackedColumn,
    level: PackedColumn
  ]
  l: [
    languageId: PackedColumn,
    nodeId: PackedColumn,
    locale: PackedColumn,
    parentDir: PackedColumn,
    selfDir: PackedColumn,
    activeRowId: PackedColumn,
    mainRowId: PackedColumn,
    inheritedStatus: PackedColumn,
    url: PackedColumn,
    path: PackedColumn,
    seeded: PackedColumn,
    versionRowIds: PackedColumn
  ]
  n: [
    nodeId: PackedColumn,
    id: PackedColumn,
    index: PackedColumn,
    parentId: PackedColumn,
    parents: PackedColumn,
    workspace: PackedColumn,
    root: PackedColumn,
    type: PackedColumn,
    level: PackedColumn,
    languageIds: PackedColumn,
    childNodeIds: PackedColumn
  ]
}

export type CompactEntryVersionRow = [
  rowId: string,
  versionId: string,
  nodeId: string,
  languageId: string,
  id: string,
  type: string,
  index: string,
  title: string,
  searchableText: string,
  seeded: string | null,
  rowHash: string,
  fileHash: string,
  data: Record<string, unknown>,
  status: EntryStatus,
  locale: string | null,
  workspace: string,
  root: string,
  path: string,
  parentDir: string,
  childrenDir: string,
  filePath: string,
  level: number
]

export type CompactEntryLanguageRow = [
  languageId: string,
  nodeId: string,
  locale: string | null,
  parentDir: string,
  selfDir: string,
  activeRowId: string,
  mainRowId: string,
  inheritedStatus: EntryStatus | null,
  url: string,
  path: string,
  seeded: string | null,
  versionRowIds: Array<string>
]

export type CompactEntryNodeRow = [
  nodeId: string,
  id: string,
  index: string,
  parentId: string | null,
  parents: Array<string>,
  workspace: string,
  root: string,
  type: string,
  level: number,
  languageIds: Array<string>,
  childNodeIds: Array<string>
]

export function compactEntrySnapshot(
  snapshot: EntrySnapshot
): CompactEntrySnapshot {
  const compact: CompactEntrySnapshot = {
    v: snapshot.version,
    g: snapshot.graphSha,
    m: snapshot.manifest,
    t: snapshot.tree,
    r: compactEntryRows(snapshot.rows)
  }
  if (snapshot.search) compact.s = snapshot.search
  return compact
}

export function expandEntrySnapshot(
  compact: CompactEntrySnapshot
): EntrySnapshot {
  const rows = expandEntryRows(compact.r)
  const snapshot: EntrySnapshot = {
    version: compact.v,
    manifest: compact.m,
    graphSha: compact.g,
    tree: compact.t,
    rows,
    indexes: createEntrySnapshotIndexes(rows)
  }
  if (compact.s) snapshot.search = compact.s
  return snapshot
}

export function packEntrySnapshot(
  snapshot: EntrySnapshot
): PackedEntrySnapshot {
  const compact = compactEntrySnapshot(snapshot)
  const dictionary = createDictionary(compact.r, compact.t)
  const encode = (value: string): string =>
    dictionary.index.get(value)!.toString(36)
  const packed: PackedEntrySnapshot = {
    p: 1,
    v: compact.v,
    g: encode(compact.g),
    m: compact.m,
    t: packTree(compact.t, encode),
    d: dictionary.values,
    r: packEntryRows(compact.r, encode)
  }
  if (compact.s) packed.s = compact.s
  return packed
}

export function unpackEntrySnapshot(
  packed: PackedEntrySnapshot
): EntrySnapshot {
  const dictionary = packed.d.map(unpackDictionaryString)
  const decode = (value: string): string => dictionary[parseInt(value, 36)]
  return expandEntrySnapshot({
    v: packed.v,
    g: decode(packed.g),
    m: packed.m,
    t: unpackTree(packed.t, decode),
    r: unpackEntryRows(packed.r, decode),
    s: packed.s
  })
}

function compactEntryRows(rows: EntryRowStore): CompactEntryRows {
  return {
    v: rows.versions.map(compactVersionRow),
    l: rows.languages.map(compactLanguageRow),
    n: rows.nodes.map(compactNodeRow)
  }
}

function packTree(
  tree: FlatTree,
  encode: (value: string) => string
): PackedFlatTree {
  return {
    s: encode(tree.sha),
    p: packStrings(
      tree.tree.map(entry => entry.path),
      encode
    ),
    m: packStrings(
      tree.tree.map(entry => entry.mode),
      encode
    ),
    h: packStrings(
      tree.tree.map(entry => entry.sha),
      encode
    ),
    y: packStrings(
      tree.tree.map(entry => entry.type),
      encode
    )
  }
}

function unpackTree(
  tree: PackedFlatTree,
  decode: (value: string) => string
): FlatTree {
  const rows = countPackedRows(tree.p)
  return {
    sha: decode(tree.s),
    tree: Array.from({length: rows}, (_, index) => {
      return {
        path: unpackString(tree.p, index, decode),
        mode: unpackString(tree.m, index, decode),
        sha: unpackString(tree.h, index, decode),
        type: unpackString(tree.y, index, decode)
      }
    })
  }
}

function packEntryRows(
  rows: CompactEntryRows,
  encode: (value: string) => string
): PackedEntryRows {
  return {
    v: [
      packStrings(
        rows.v.map(row => row[0]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[1]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[2]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[3]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[4]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[5]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[6]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[7]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[8]),
        encode
      ),
      packNullableStrings(
        rows.v.map(row => row[9]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[10]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[11]),
        encode
      ),
      packDataRows(
        rows.v.map(row => row[12]),
        encode
      ),
      packStatuses(rows.v.map(row => row[13])),
      packNullableStrings(
        rows.v.map(row => row[14]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[15]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[16]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[17]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[18]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[19]),
        encode
      ),
      packStrings(
        rows.v.map(row => row[20]),
        encode
      ),
      packNumbers(rows.v.map(row => row[21]))
    ],
    l: [
      packStrings(
        rows.l.map(row => row[0]),
        encode
      ),
      packStrings(
        rows.l.map(row => row[1]),
        encode
      ),
      packNullableStrings(
        rows.l.map(row => row[2]),
        encode
      ),
      packStrings(
        rows.l.map(row => row[3]),
        encode
      ),
      packStrings(
        rows.l.map(row => row[4]),
        encode
      ),
      packStrings(
        rows.l.map(row => row[5]),
        encode
      ),
      packStrings(
        rows.l.map(row => row[6]),
        encode
      ),
      packNullableStatuses(rows.l.map(row => row[7])),
      packStrings(
        rows.l.map(row => row[8]),
        encode
      ),
      packStrings(
        rows.l.map(row => row[9]),
        encode
      ),
      packNullableStrings(
        rows.l.map(row => row[10]),
        encode
      ),
      packStringArrays(
        rows.l.map(row => row[11]),
        encode
      )
    ],
    n: [
      packStrings(
        rows.n.map(row => row[0]),
        encode
      ),
      packStrings(
        rows.n.map(row => row[1]),
        encode
      ),
      packStrings(
        rows.n.map(row => row[2]),
        encode
      ),
      packNullableStrings(
        rows.n.map(row => row[3]),
        encode
      ),
      packStringArrays(
        rows.n.map(row => row[4]),
        encode
      ),
      packStrings(
        rows.n.map(row => row[5]),
        encode
      ),
      packStrings(
        rows.n.map(row => row[6]),
        encode
      ),
      packStrings(
        rows.n.map(row => row[7]),
        encode
      ),
      packNumbers(rows.n.map(row => row[8])),
      packStringArrays(
        rows.n.map(row => row[9]),
        encode
      ),
      packStringArrays(
        rows.n.map(row => row[10]),
        encode
      )
    ]
  }
}

function unpackEntryRows(
  rows: PackedEntryRows,
  decode: (value: string) => string
): CompactEntryRows {
  const versionRows = countPackedRows(rows.v[0])
  const languageRows = countPackedRows(rows.l[0])
  const nodeRows = countPackedRows(rows.n[0])
  return {
    v: Array.from({length: versionRows}, (_, index) => [
      unpackString(rows.v[0], index, decode),
      unpackString(rows.v[1], index, decode),
      unpackString(rows.v[2], index, decode),
      unpackString(rows.v[3], index, decode),
      unpackString(rows.v[4], index, decode),
      unpackString(rows.v[5], index, decode),
      unpackString(rows.v[6], index, decode),
      unpackString(rows.v[7], index, decode),
      unpackString(rows.v[8], index, decode),
      unpackNullableString(rows.v[9], index, decode),
      unpackString(rows.v[10], index, decode),
      unpackString(rows.v[11], index, decode),
      unpackDataRows(rows.v[12], decode)[index],
      unpackStatus(rows.v[13], index),
      unpackNullableString(rows.v[14], index, decode),
      unpackString(rows.v[15], index, decode),
      unpackString(rows.v[16], index, decode),
      unpackString(rows.v[17], index, decode),
      unpackString(rows.v[18], index, decode),
      unpackString(rows.v[19], index, decode),
      unpackString(rows.v[20], index, decode),
      unpackNumber(rows.v[21], index)
    ]),
    l: Array.from({length: languageRows}, (_, index) => [
      unpackString(rows.l[0], index, decode),
      unpackString(rows.l[1], index, decode),
      unpackNullableString(rows.l[2], index, decode),
      unpackString(rows.l[3], index, decode),
      unpackString(rows.l[4], index, decode),
      unpackString(rows.l[5], index, decode),
      unpackString(rows.l[6], index, decode),
      unpackNullableStatus(rows.l[7], index),
      unpackString(rows.l[8], index, decode),
      unpackString(rows.l[9], index, decode),
      unpackNullableString(rows.l[10], index, decode),
      unpackStringArrays(rows.l[11], languageRows, decode)[index]
    ]),
    n: Array.from({length: nodeRows}, (_, index) => [
      unpackString(rows.n[0], index, decode),
      unpackString(rows.n[1], index, decode),
      unpackString(rows.n[2], index, decode),
      unpackNullableString(rows.n[3], index, decode),
      unpackStringArrays(rows.n[4], nodeRows, decode)[index],
      unpackString(rows.n[5], index, decode),
      unpackString(rows.n[6], index, decode),
      unpackString(rows.n[7], index, decode),
      unpackNumber(rows.n[8], index),
      unpackStringArrays(rows.n[9], nodeRows, decode)[index],
      unpackStringArrays(rows.n[10], nodeRows, decode)[index]
    ])
  }
}

function expandEntryRows(rows: CompactEntryRows): EntryRowStore {
  return {
    versions: rows.v.map(expandVersionRow),
    languages: rows.l.map(expandLanguageRow),
    nodes: rows.n.map(expandNodeRow)
  }
}

function compactVersionRow(row: EntryVersionRow): CompactEntryVersionRow {
  return [
    row.rowId,
    row.versionId,
    row.nodeId,
    row.languageId,
    row.id,
    row.type,
    row.index,
    row.title,
    row.searchableText,
    row.seeded,
    row.rowHash,
    row.fileHash,
    row.data,
    row.status,
    row.locale,
    row.workspace,
    row.root,
    row.path,
    row.parentDir,
    row.childrenDir,
    row.filePath,
    row.level
  ]
}

function expandVersionRow(row: CompactEntryVersionRow): EntryVersionRow {
  return {
    rowId: row[0],
    versionId: row[1],
    nodeId: row[2],
    languageId: row[3],
    id: row[4],
    type: row[5],
    index: row[6],
    title: row[7],
    searchableText: row[8],
    seeded: row[9],
    rowHash: row[10],
    fileHash: row[11],
    data: row[12],
    status: row[13],
    locale: row[14],
    workspace: row[15],
    root: row[16],
    path: row[17],
    parentDir: row[18],
    childrenDir: row[19],
    filePath: row[20],
    level: row[21]
  }
}

function compactLanguageRow(row: EntryLanguageRow): CompactEntryLanguageRow {
  return [
    row.languageId,
    row.nodeId,
    row.locale,
    row.parentDir,
    row.selfDir,
    row.activeRowId,
    row.mainRowId,
    row.inheritedStatus ?? null,
    row.url,
    row.path,
    row.seeded,
    row.versionRowIds
  ]
}

function expandLanguageRow(row: CompactEntryLanguageRow): EntryLanguageRow {
  return {
    languageId: row[0],
    nodeId: row[1],
    locale: row[2],
    parentDir: row[3],
    selfDir: row[4],
    activeRowId: row[5],
    mainRowId: row[6],
    inheritedStatus: row[7] ?? undefined,
    url: row[8],
    path: row[9],
    seeded: row[10],
    versionRowIds: row[11]
  }
}

function compactNodeRow(row: EntryNodeRow): CompactEntryNodeRow {
  return [
    row.nodeId,
    row.id,
    row.index,
    row.parentId,
    row.parents,
    row.workspace,
    row.root,
    row.type,
    row.level,
    row.languageIds,
    row.childNodeIds
  ]
}

function expandNodeRow(row: CompactEntryNodeRow): EntryNodeRow {
  return {
    nodeId: row[0],
    id: row[1],
    index: row[2],
    parentId: row[3],
    parents: row[4],
    workspace: row[5],
    root: row[6],
    type: row[7],
    level: row[8],
    languageIds: row[9],
    childNodeIds: row[10]
  }
}

function packStrings(
  values: ReadonlyArray<string>,
  encode: (value: string) => string
): string {
  return values.map(encode).join(',')
}

function packNullableStrings(
  values: ReadonlyArray<string | null>,
  encode: (value: string) => string
): string {
  return values.map(value => (value === null ? '-' : encode(value))).join(',')
}

function packStringArrays(
  values: ReadonlyArray<ReadonlyArray<string>>,
  encode: (value: string) => string
): string {
  return values.map(items => items.map(encode).join(',')).join(';')
}

function packNumbers(values: ReadonlyArray<number>): string {
  return values.map(value => value.toString(36)).join(',')
}

function packStatuses(values: ReadonlyArray<EntryStatus>): string {
  return values.map(statusCode).join('')
}

function packNullableStatuses(
  values: ReadonlyArray<EntryStatus | null>
): string {
  return values
    .map(value => (value === null ? '-' : statusCode(value)))
    .join('')
}

function packDataRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  encode: (value: string) => string
): PackedDataRows {
  const shapes = Array<Array<string>>()
  const shapeIds = new Map<string, number>()
  const indexes = Array<number>()
  const values = Array<Array<PackedJson>>()
  for (const row of rows) {
    const keys = Object.keys(row)
    const shapeKey = keys.join('\0')
    let shapeId = shapeIds.get(shapeKey)
    if (shapeId === undefined) {
      shapeId = shapes.length
      shapeIds.set(shapeKey, shapeId)
      shapes.push(keys.map(encode))
    }
    indexes.push(shapeId)
    values.push(keys.map(key => packJson(row[key], encode)))
  }
  return {
    k: shapes,
    i: packNumbers(indexes),
    v: values
  }
}

function unpackDataRows(
  rows: PackedDataRows,
  decode: (value: string) => string
): Array<Record<string, unknown>> {
  const indexes = rows.i === '' ? [] : rows.i.split(',').map(Number)
  return rows.v.map((values, rowIndex) => {
    const keys = rows.k[indexes[rowIndex]]
    return Object.fromEntries(
      keys.map((key, index) => [decode(key), unpackJson(values[index], decode)])
    )
  })
}

function packJson(
  value: unknown,
  encode: (value: string) => string
): PackedJson {
  if (typeof value === 'string') return encode(value)
  if (value === null || typeof value !== 'object') return value as PackedJson
  if (Array.isArray(value)) return value.map(item => packJson(item, encode))
  return {
    o: Object.entries(value).map(([key, value]) => {
      return [encode(key), packJson(value, encode)]
    })
  }
}

function unpackJson(
  value: PackedJson,
  decode: (value: string) => string
): unknown {
  if (typeof value === 'string') return decode(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => unpackJson(item, decode))
  return Object.fromEntries(
    value.o.map(([key, value]) => [decode(key), unpackJson(value, decode)])
  )
}

function unpackString(
  column: string,
  index: number,
  decode: (value: string) => string
): string {
  return decode(column.split(',')[index])
}

function unpackNullableString(
  column: string,
  index: number,
  decode: (value: string) => string
): string | null {
  const value = column.split(',')[index]
  return value === '-' ? null : decode(value)
}

function unpackStringArrays(
  column: string,
  rows: number,
  decode: (value: string) => string
): Array<Array<string>> {
  if (rows === 0) return []
  return column.split(';').map(row => {
    if (row === '') return []
    return row.split(',').map(decode)
  })
}

function unpackNumber(column: string, index: number): number {
  return parseInt(column.split(',')[index], 36)
}

function unpackStatus(column: string, index: number): EntryStatus {
  return statusFromCode(Number(column[index]) as PackedStatus)
}

function unpackNullableStatus(
  column: string,
  index: number
): EntryStatus | null {
  const value = column[index]
  return value === '-' ? null : statusFromCode(Number(value) as PackedStatus)
}

function countPackedRows(column: string): number {
  if (column === '') return 0
  return column.split(',').length
}

function createDictionary(rows: CompactEntryRows, tree: FlatTree) {
  const counts = new Map<string, number>()
  const add = (value: string | null) => {
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  add(tree.sha)
  for (const entry of tree.tree) {
    add(entry.path)
    add(entry.mode)
    add(entry.sha)
    add(entry.type)
  }
  for (const row of rows.v) {
    add(row[0])
    add(row[1])
    add(row[2])
    add(row[3])
    add(row[4])
    add(row[5])
    add(row[6])
    add(row[7])
    add(row[8])
    add(row[9])
    add(row[10])
    add(row[11])
    addData(row[12], add)
    add(row[14])
    add(row[15])
    add(row[16])
    add(row[17])
    add(row[18])
    add(row[19])
    add(row[20])
  }
  for (const row of rows.l) {
    add(row[0])
    add(row[1])
    add(row[2])
    add(row[3])
    add(row[4])
    add(row[5])
    add(row[6])
    add(row[8])
    add(row[9])
    add(row[10])
    for (const id of row[11]) add(id)
  }
  for (const row of rows.n) {
    add(row[0])
    add(row[1])
    add(row[2])
    add(row[3])
    for (const id of row[4]) add(id)
    add(row[5])
    add(row[6])
    add(row[7])
    for (const id of row[9]) add(id)
    for (const id of row[10]) add(id)
  }
  const values = Array.from(counts)
    .map(([value]) => value)
    .sort((a, b) => {
      return counts.get(b)! - counts.get(a)! || b.length - a.length
    })
  return {
    values: values.map(packDictionaryString),
    index: new Map(values.map((value, index) => [value, index]))
  }
}

const shaPattern = /^[a-f0-9]{40}$/

function packDictionaryString(value: string): string {
  if (!shaPattern.test(value)) return value
  return `~h${hexToBase64Url(value)}`
}

function unpackDictionaryString(value: string): string {
  if (!value.startsWith('~h')) return value
  return base64UrlToHex(value.slice(2))
}

function hexToBase64Url(hex: string): string {
  let binary = ''
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToHex(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  let hex = ''
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0')
  }
  return hex
}

function addData(value: unknown, add: (value: string | null) => void): void {
  if (typeof value === 'string') return add(value)
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) addData(item, add)
    return
  }
  for (const [key, item] of Object.entries(value)) {
    add(key)
    addData(item, add)
  }
}

function statusCode(status: EntryStatus): PackedStatus {
  switch (status) {
    case 'published':
      return 0
    case 'draft':
      return 1
    case 'archived':
      return 2
  }
}

function statusFromCode(status: PackedStatus): EntryStatus {
  switch (status) {
    case 0:
      return 'published'
    case 1:
      return 'draft'
    case 2:
      return 'archived'
  }
}
