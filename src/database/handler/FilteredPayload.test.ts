import {expect, spyOn, test} from 'bun:test'
import {Config, Field} from '#/index.js'
import {Permission} from '#/core/Role.js'
import {Field as FieldUtils} from '#/core/Field.js'
import {entry} from '#test/sqlite-browser/config.js'
import type {AuthorizedEntry} from './Policy.js'
import {filterPayload, payloadProjection} from './FilteredPayload.js'

const config = {
  schema: {
    Page: Config.document('Page', {
      fields: {
        title: Field.text('Title', {searchable: true}),
        secret: Field.text('Secret', {searchable: true}),
        object: Field.object('Object', {fields: {nested: Field.text('Nested')}})
      }
    })
  },
  workspaces: {}
}
function row(): AuthorizedEntry {
  return {
    entry: entry('a', 'Public title'),
    permissions: Permission.All,
    payloadId: 'source',
    fields: {
      title: Permission.All,
      secret: Permission.Explore,
      object: Permission.Read
    }
  }
}

test('filtered payloads omit denied and unknown fields and rebuild search text without them', async () => {
  const projection = await payloadProjection(row())
  const input = {
    versionId: projection.versionId,
    payloadId: 'source',
    data: {
      title: 'Public title',
      secret: 'CLASSIFIED',
      unknown: 'HIDDEN',
      object: {nested: 'allowed'}
    },
    source: {
      filePath: 'pages/a.json',
      fileHash: 'source-file-hash',
      searchableText: 'Public title CLASSIFIED HIDDEN'
    }
  }
  const filtered = filterPayload(config, projection, input)
  expect(filtered.payloadId).not.toBe('source')
  expect(filtered.data).toEqual({
    title: 'Public title',
    object: {nested: 'allowed'}
  })
  expect(filtered.source).toEqual({
    filePath: 'pages/a.json',
    fileHash: 'source-file-hash',
    searchableText: 'Public title'
  })
  expect(JSON.stringify(filtered)).not.toContain('CLASSIFIED')
  expect(JSON.stringify(filtered)).not.toContain('HIDDEN')
  input.data.object.nested = 'later'
  input.source.filePath = 'changed'
  expect(filtered.data.object).toEqual({nested: 'allowed'})
  expect(filtered.source!.filePath).toBe('pages/a.json')
  expect(input.source.searchableText).toContain('CLASSIFIED')
})

test('projection identities bind owner, source and read mask, without depending on field ordering or write grants', async () => {
  const original = row(),
    pending = payloadProjection(original)
  original.fields.secret = Permission.All
  original.payloadId = 'changed'
  const projection = await pending
  expect(projection.sourcePayloadId).toBe('source')
  expect(Object.isFrozen(projection)).toBe(true)
  expect(Object.isFrozen(projection.readableFields)).toBe(true)
  expect(projection.readableFields).toEqual(['object', 'title'])
  expect(
    (
      await payloadProjection({
        ...row(),
        fields: {
          object: Permission.Read,
          secret: Permission.None,
          title: Permission.Read
        }
      })
    ).payloadId
  ).toBe(projection.payloadId)
  expect(
    (await payloadProjection({...row(), payloadId: 'changed'})).payloadId
  ).not.toBe(projection.payloadId)
  expect(
    (await payloadProjection({...row(), entry: entry('b')})).payloadId
  ).not.toBe(projection.payloadId)
  expect(
    (
      await payloadProjection({
        ...row(),
        fields: {...row().fields, secret: Permission.Read}
      })
    ).payloadId
  ).not.toBe(projection.payloadId)
  for (const permissions of [
    Permission.None,
    Permission.Read,
    Permission.Explore
  ])
    await expect(payloadProjection({...row(), permissions})).rejects.toThrow(
      'not readable'
    )
})

test('empty read masks disclose no data or search text and projections reject the wrong source', async () => {
  const projection = await payloadProjection({
    ...row(),
    fields: {
      title: Permission.None,
      secret: Permission.None,
      object: Permission.None
    }
  })
  const input = {
    versionId: projection.versionId,
    payloadId: 'source',
    data: {title: 'secret'},
    source: {searchableText: 'secret'}
  }
  expect(filterPayload(config, projection, input)).toEqual({
    versionId: projection.versionId,
    payloadId: projection.payloadId,
    data: {},
    source: {searchableText: ''}
  })
  expect(() =>
    filterPayload(config, projection, {...input, payloadId: 'stale'})
  ).toThrow('source mismatch')
  expect(() =>
    filterPayload(config, projection, {...input, versionId: 'other'})
  ).toThrow('source mismatch')
  expect(() =>
    filterPayload(config, {...projection, readableFields: ['unknown']}, input)
  ).toThrow('projection field')
  expect(() =>
    filterPayload(
      config,
      {...projection, readableFields: ['title', 'title']},
      input
    )
  ).toThrow('projection field')
})

test('denied field search hooks are never invoked while deriving the filtered search text', async () => {
  const projection = await payloadProjection(row())
  const called: Array<unknown> = []
  const searchable = spyOn(FieldUtils, 'searchableText').mockImplementation(
    field => {
      called.push(field)
      return ''
    }
  )
  try {
    filterPayload(config, projection, {
      versionId: projection.versionId,
      payloadId: 'source',
      data: {title: 'Public', secret: 'Private'}
    })
    expect(called).toContain(config.schema.Page.title)
    expect(called).not.toContain(config.schema.Page.secret)
  } finally {
    searchable.mockRestore()
  }
})
