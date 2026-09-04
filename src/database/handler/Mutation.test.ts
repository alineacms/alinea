import {describe, expect, test} from 'bun:test'
import {Policy} from '#/core/Role.js'
import {DatabaseSnapshot} from '../Database.js'
import {entryDatabaseSchema} from '../entry/Indexes.js'
import type {AlineaDatabaseRecord, EntryCoreRecord} from '../entry/Model.js'
import {ReaderEntryStore} from '../entry/Store.js'
import {hashFieldValue} from '../replica/Operations.js'
import type {RuntimeIndexEntry} from '../runtime/Model.js'
import {prepareFieldMutation, prepareRuntimeFieldMutation} from './Mutation.js'

const records: Array<AlineaDatabaseRecord> = [
  {
    kind: 'entry',
    id: 'entry:page',
    queryable: true,
    entryId: 'page',
    versionStatus: 'published',
    status: 'published',
    active: true,
    main: true,
    type: 'Page',
    title: 'Before',
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: 0,
    index: 'a0',
    parentId: null,
    parents: [],
    path: 'page',
    url: '/page'
  },
  {
    kind: 'entryRead',
    id: 'entry-read:page',
    entryVersionId: 'entry:page',
    filePath: 'pages/page.json',
    parentDir: 'pages',
    childrenDir: 'pages/page',
    rowHash: 'row',
    fileHash: 'file',
    payloadId: 'payload:page'
  },
  {
    kind: 'payload',
    id: 'payload:page',
    entryVersionId: 'entry:page',
    data: {title: 'Before', body: 'Remote body'}
  }
]

describe('prepareFieldMutation', () => {
  test('maps accepted core field paths to a cloud update mutation', async () => {
    const snapshot = new DatabaseSnapshot({
      schema: entryDatabaseSchema,
      revision: 'tree-1',
      records
    })
    const prepared = await prepareFieldMutation(
      snapshot,
      {
        id: 'tx-1',
        baseRevision: 'tree-1',
        operations: [
          {
            kind: 'set',
            recordId: 'entry:page',
            path: '/title',
            baseHash: await hashFieldValue('Before'),
            value: 'After'
          },
          {
            kind: 'set',
            recordId: 'entry:page',
            path: '/body',
            baseHash: await hashFieldValue('Stale body'),
            value: 'Local body'
          }
        ]
      },
      Policy.ALLOW_ALL
    )

    expect(prepared.mutations).toEqual([
      {
        op: 'update',
        id: 'page',
        locale: null,
        status: 'published',
        set: {title: 'After'}
      }
    ])
    expect(prepared.conflicts).toHaveLength(1)
    expect(prepared.conflicts[0].recordId).toBe('entry:page')
    expect(prepared.conflicts[0].path).toBe('/body')
  })

  test('loads the addressed runtime entry without a normalized fallback', async () => {
    const snapshot = new DatabaseSnapshot({
      schema: entryDatabaseSchema,
      revision: 'tree-1',
      records
    })
    const core: RuntimeIndexEntry = {
      ...(records[0] as EntryCoreRecord),
      frames: {
        decodeKey: 'unused',
        read: {
          filePath: 'pages/page.json',
          parentDir: 'pages',
          childrenDir: 'pages/page',
          rowHash: 'row',
          fileHash: 'file'
        }
      }
    }
    const prepared = await prepareRuntimeFieldMutation(
      new ReaderEntryStore(snapshot),
      [core],
      {
        id: 'tx-runtime',
        baseRevision: 'tree-1',
        operations: [
          {
            kind: 'set',
            recordId: 'payload:pages/page.json',
            path: '/title',
            baseHash: await hashFieldValue('Before'),
            value: 'After'
          }
        ]
      },
      Policy.ALLOW_ALL
    )

    expect(prepared).toEqual({
      mutations: [
        {
          op: 'update',
          id: 'page',
          locale: null,
          status: 'published',
          set: {title: 'After'}
        }
      ],
      conflicts: []
    })
  })
})
