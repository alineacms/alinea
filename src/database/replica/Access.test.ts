import {suite} from '@alinea/suite'
import {
  canAccessFrameClass,
  createAccessGrants,
  createFrameAccessClass
} from './Access.js'
import {RoleTable} from './RoleMask.js'

const test = suite(import.meta)

test('grants access classes across one hundred roles', () => {
  const roleNames = Array.from({length: 100}, (_, index) => `role-${index}`)
  const roles = new RoleTable(roleNames)
  const editorial = createFrameAccessClass(roles, {
    id: 'editorial',
    allow: ['role-3', 'role-72'],
    deny: ['role-99'],
    key: new Uint8Array([1, 2, 3])
  })
  const legal = createFrameAccessClass(roles, {
    id: 'legal',
    allow: ['role-81'],
    key: new Uint8Array([4, 5, 6])
  })

  test.ok(canAccessFrameClass(roles.mask(['role-72']), editorial))
  test.not.ok(
    canAccessFrameClass(roles.mask(['role-72', 'role-99']), editorial)
  )
  test.not.ok(canAccessFrameClass(roles.mask(['unknown']), editorial))

  const grants = createAccessGrants(roles.mask(['role-72']), [editorial, legal])
  test.equal(
    grants.map(grant => grant.accessClassId),
    ['editorial']
  )
  test.equal(grants[0].key, new Uint8Array([1, 2, 3]))
})

test('role masks compose without enumerating role combinations', () => {
  const roles = new RoleTable(['author', 'reviewer', 'restricted'])
  const editorial = roles.mask(['author']).union(roles.mask(['reviewer']))

  test.ok(editorial.equals(roles.mask(['author', 'reviewer'])))
  test.ok(editorial.intersects(roles.mask(['reviewer'])))
  test.not.ok(editorial.intersects(roles.mask(['restricted'])))
})
