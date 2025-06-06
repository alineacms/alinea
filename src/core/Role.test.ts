import {suite} from '@alinea/suite'
import {type Tag, WriteablePolicy, role} from './Role.js'

const admin = role('Admin', {
  permissions(policy) {
    policy.applyAll({
      create: true,
      read: true,
      update: true,
      delete: true,
      reorder: true,
      move: true,
      publish: true,
      archive: true,
      upload: true,
      explore: true
    })
  }
})

const test = suite(import.meta)

function getTags(tag: Tag) {
  if (tag === 'c') return new Set(['a', 'b'])
  if (tag === 'b') return new Set(['a'])
}

test('root', async () => {
  const policy = new WriteablePolicy(getTags)
  await admin.permissions(policy, undefined!)

  test.ok(policy.canAll('a'))
})

const editB = role('Edit B', {
  permissions(policy) {
    policy.applyEntry('b', {
      read: true,
      update: true
    })
  }
})

test('editB', async () => {
  const policy = new WriteablePolicy(getTags)
  await editB.permissions(policy, undefined!)

  test.ok(policy.canRead('b'))
  test.ok(policy.canUpdate('b'))
  test.ok(policy.canRead('c'))
  test.ok(policy.canUpdate('c'))
  test.not.ok(policy.canDelete('b'))
  test.not.ok(policy.canCreate('b'))
  test.not.ok(policy.canRead('a'))
})
