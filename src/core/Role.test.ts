import {suite} from '@alinea/suite'
import {root, type, workspace} from 'alinea/config.js'
import {createConfig} from './Config.js'
import {Policy, role, WriteablePolicy} from './Role.js'
import {getScope} from './Scope.js'

const test = suite(import.meta)

const admin = role('Admin', {
  permissions(policy) {
    policy.set({
      allow: {
        all: true
      }
    })
  }
})

const type1 = type('Type1', {
  fields: {}
})

const root1 = root('Root1', {})

const workspace1 = workspace('Workspace1', {
  source: 'content',
  roots: {root1}
})

const config = createConfig({
  schema: {type1},
  workspaces: {workspace1}
})

const scope = getScope(config)

const a = {id: 'a'}
const b = {id: 'b', parents: ['a']}
const c = {id: 'c', parents: ['a', 'b']}

test('root', async () => {
  const policy = new WriteablePolicy(scope)
  await admin.permissions(policy, undefined!)
  test.ok(policy.canAll(a))
})

const editB = role('Edit B', {
  permissions(policy) {
    policy.set({
      id: b.id,
      allow: {
        read: true,
        update: true
      }
    })
  }
})

test('editB', async () => {
  const policy = new WriteablePolicy(scope)
  await editB.permissions(policy, undefined!)
  test.ok(policy.canRead(b))
  test.ok(policy.canUpdate(b))
  test.ok(policy.canRead(c))
  test.ok(policy.canUpdate(c))
  test.not.ok(policy.canDelete(b))
  test.not.ok(policy.canCreate(b))
  test.not.ok(policy.canRead(a))
})

const explicitDeny = role('Explicit Deny', {
  permissions(policy) {
    // This should mean we can read a, b and c
    policy.allowAll()
    // But this should deny reading c specifically
    policy.set({
      id: c.id,
      deny: {
        read: true
      }
    })
  }
})

test('explicitDeny', async () => {
  const policy = new WriteablePolicy(scope)
  await explicitDeny.permissions(policy, undefined!)

  test.ok(policy.canRead(a))
  test.ok(policy.canRead(b))
  test.ok(policy.canCreate(c))
  test.not.ok(policy.canRead(c))
})

test('admin permissions', async () => {
  const policy = new WriteablePolicy(scope)
  await admin.permissions(policy, undefined!)

  test.ok(policy.canCreate(a))
  test.ok(policy.canRead(a))
  test.ok(policy.canUpdate(a))
  test.ok(policy.canDelete(a))
  test.ok(policy.canReorder(a))
  test.ok(policy.canMove(a))
  test.ok(policy.canPublish(a))
  test.ok(policy.canArchive(a))
  test.ok(policy.canUpload(a))
  test.ok(policy.canExplore(a))
})

test('editB negative checks', async () => {
  const policy = new WriteablePolicy(scope)
  await editB.permissions(policy, undefined!)

  // Should not have permissions other than read/update on b and c
  test.not.ok(policy.canDelete(c))
  test.not.ok(policy.canCreate(c))
  test.not.ok(policy.canPublish(b))
  test.not.ok(policy.canArchive(b))
  test.not.ok(policy.canUpload(b))
  test.not.ok(policy.canExplore(b))
})

test('explicitDeny negative checks', async () => {
  const policy = new WriteablePolicy(scope)
  await explicitDeny.permissions(policy, undefined!)

  // Should have all permissions except read on c
  test.ok(policy.canUpdate(c))
  test.ok(policy.canDelete(c))
  test.ok(policy.canReorder(c))
  test.ok(policy.canMove(c))
  test.ok(policy.canPublish(c))
  test.ok(policy.canArchive(c))
  test.ok(policy.canUpload(c))
  test.ok(policy.canExplore(c))
  test.not.ok(policy.canRead(c))
})

test('inheritance logic', async () => {
  const policy = new WriteablePolicy(scope)
  // Simulate direct permission on a
  policy.set({id: a.id, allow: {read: true}})
  // b should inherit from a
  test.ok(policy.canRead(b))
  // c should inherit from a and b
  test.ok(policy.canRead(c))
  // Remove a permission, b and c should lose inherited read
  policy.set({id: a.id, deny: {read: true}})
  test.not.ok(policy.canRead(b))
  test.not.ok(policy.canRead(c))
})

test('deny overrides allow', async () => {
  const policy = new WriteablePolicy(scope)
  policy.allowAll()
  policy.set({id: a.id, deny: {delete: true}})
  test.not.ok(policy.canDelete(a))
  // Other permissions still allowed
  test.ok(policy.canRead(a))
})

test('default deny', async () => {
  const policy = new WriteablePolicy(scope)
  // No permissions applied
  test.not.ok(policy.canRead(a))
  test.not.ok(policy.canCreate(a))
  test.not.ok(policy.canUpdate(a))
  test.not.ok(policy.canDelete(a))
  test.not.ok(policy.canReorder(a))
  test.not.ok(policy.canMove(a))
  test.not.ok(policy.canPublish(a))
  test.not.ok(policy.canArchive(a))
  test.not.ok(policy.canUpload(a))
  test.not.ok(policy.canExplore(a))
})

test('blank policy', () => {
  const policy = new Policy()
  test.not.ok(policy.canRead(a))
  test.not.ok(policy.canCreate(a))
  test.not.ok(policy.canUpdate(a))
  test.not.ok(policy.canDelete(a))
  test.not.ok(policy.canReorder(a))
  test.not.ok(policy.canMove(a))
  test.not.ok(policy.canPublish(a))
  test.not.ok(policy.canArchive(a))
  test.not.ok(policy.canUpload(a))
  test.not.ok(policy.canExplore(a))
})

test('Policy.from creates a copy', async () => {
  const policy1 = new WriteablePolicy(scope)
  policy1.set({id: a.id, allow: {read: true}})
  const policy2 = Policy.from(policy1)
  test.ok(policy2.canRead(a))
  // Mutating policy1 does not affect policy2
  policy1.set({id: a.id, deny: {read: true}})
  test.ok(policy2.canRead(a))
})

test('Policy.concat merges permissions', async () => {
  const p1 = new WriteablePolicy(scope)
  const p2 = new WriteablePolicy(scope)
  p1.set({id: a.id, allow: {read: true}})
  p2.set({id: a.id, allow: {update: true}})
  const merged = p1.concat(p2)
  test.ok(merged.canRead(a))
  test.ok(merged.canUpdate(a))
})

test('WriteablePolicy.applyWorkspace, applyRoot, applyType', async () => {
  const policy = new WriteablePolicy(scope)
  // Use string as dummy resource for workspace/root/type
  policy.set({workspace: workspace1, allow: {read: true}})
  test.ok(policy.canRead({workspace: 'workspace1'}))
  policy.set({root: root1, allow: {update: true}})
  test.ok(policy.canUpdate({workspace: 'workspace1', root: 'root1'}))
  policy.set({type: type1, allow: {delete: true}})
  test.ok(policy.canDelete({type: 'type1'}))
})

test('WriteablePolicy chaining', async () => {
  const policy = new WriteablePolicy(scope)
  policy
    .set({id: a.id, allow: {read: true}})
    .set({id: a.id, allow: {update: true}})
  test.not.ok(policy.canRead(a))
  test.ok(policy.canUpdate(a))
})

test('role factory returns correct label and config', () => {
  const r = role('Test', {permissions() {}, description: 'desc'})
  test.is(r.label, 'Test')
  test.is(r.description, 'desc')
  test.ok(typeof r.permissions === 'function')
})

test('WriteablePolicy.applyAll merges with allowAll', () => {
  const policy = new WriteablePolicy(scope)
  policy.allowAll()
  policy.set({deny: {read: true}})
  test.not.ok(policy.canRead(a))
  test.ok(policy.canCreate(a))
})

test('locale permissions', async () => {
  const policy = new WriteablePolicy(scope)
  policy.set({locale: 'en', allow: {read: true}})
  test.ok(policy.canRead({locale: 'en'}))
  test.not.ok(policy.canRead({locale: 'fr'}))
})
