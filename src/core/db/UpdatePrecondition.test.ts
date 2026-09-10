import {expect, test} from 'bun:test'
import {entry} from '#test/sqlite-browser/config.js'
import {
  readUpdatePrecondition,
  updatePrecondition,
  canRebaseUpdates,
  assertUpdatePrecondition
} from './UpdatePrecondition.js'
import type {UpdateMutation} from './Mutation.js'

test('field guards cover exactly the update and keep absent values distinct from null', async () => {
  const structure = entry('a')
  const set = {title: 'New', missing: null}
  const data = {title: 'Old'}
  const guard = await updatePrecondition(structure, data, set)
  expect(guard.fields.missing).toBeNull()
  await expect(
    assertUpdatePrecondition(guard, structure, data)
  ).resolves.toBeUndefined()
  await expect(
    assertUpdatePrecondition(guard, structure, {...data, missing: null})
  ).rejects.toThrow('Field changed')
  await expect(
    assertUpdatePrecondition(guard, {...structure, parentId: 'moved'}, data)
  ).rejects.toThrow('structure changed')
  for (const invalid of [
    null,
    {},
    {...guard, structure: 'bad'},
    {...guard, fields: {title: guard.fields.title}},
    {...guard, fields: {...guard.fields, extra: null}},
    {...guard, fields: {title: undefined, missing: null}}
  ])
    expect(() => readUpdatePrecondition(set, invalid)).toThrow()
})

test('only fully guarded non-structural batches can rebase', async () => {
  const set = {title: 'New'}
  const mutation: UpdateMutation = {
    op: 'update',
    id: 'a',
    locale: null,
    status: 'published',
    set,
    precondition: await updatePrecondition(entry('a'), {title: 'Old'}, set)
  }
  expect(canRebaseUpdates([mutation])).toBe(true)
  expect(canRebaseUpdates([])).toBe(false)
  expect(canRebaseUpdates([{...mutation, precondition: undefined}])).toBe(false)
  expect(canRebaseUpdates([mutation, {op: 'remove', id: 'b'}])).toBe(false)
  for (const key of [
    'path',
    'metadata',
    'aliases',
    '_id',
    'constructor',
    'prototype'
  ]) {
    const set = {[key]: 'New'}
    expect(
      canRebaseUpdates([
        {
          ...mutation,
          set,
          precondition: await updatePrecondition(entry('a'), {}, set)
        }
      ])
    ).toBe(false)
  }
})
