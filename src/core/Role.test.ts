import {suite} from '@alinea/suite'
import {type ACL, type Resource, WriteablePolicy, role} from './Role.js'

const test = suite(import.meta)

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

function inherit(tag: Resource, acl: ACL) {
  if (tag === 'c') return acl.get('a') | acl.get('b')
  if (tag === 'b') return acl.get('a')
  return 0
}

test('root', async () => {
  const policy = new WriteablePolicy(inherit)
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
  const policy = new WriteablePolicy(inherit)
  await editB.permissions(policy, undefined!)

  test.ok(policy.canRead('b'))
  test.ok(policy.canUpdate('b'))
  test.ok(policy.canRead('c'))
  test.ok(policy.canUpdate('c'))
  test.not.ok(policy.canDelete('b'))
  test.not.ok(policy.canCreate('b'))
  test.not.ok(policy.canRead('a'))
})

const explicitDeny = role('Explicit Deny', {
  permissions(policy) {
    // This should mean we can read a, b and c
    policy.allowAll()
    // But this should deny reading c specifically
    policy.applyEntry('c', {
      read: false
    })
  }
})

test('explicitDeny', async () => {
  const policy = new WriteablePolicy(inherit)
  await explicitDeny.permissions(policy, undefined!)

  test.ok(policy.canRead('a'))
  test.ok(policy.canRead('b'))
  test.ok(policy.canCreate('c'))
  test.not.ok(policy.canRead('c'))
})
