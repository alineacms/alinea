import {cms} from '#test/cms.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {Permission, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {FSSource} from '#/core/source/FSSource.js'
import {suite} from '@alinea/suite'
import {createContentState} from './ContentSync.js'

const test = suite(import.meta)

test('projects only readable entries and embeds effective permissions', async () => {
  const db = new LocalDB(cms.config, new FSSource('test/fixtures/demo'))
  await db.sync()
  const entry = Array.from(db.index.filter({})).find(
    candidate => candidate.type === 'DemoRecipe' && candidate.parentId !== null
  )!
  const policy = new WriteablePolicy(getScope(cms.config))
  policy.set({
    id: entry.id,
    allow: {read: true, update: true}
  })
  policy.set({
    field: cms.schema.DemoRecipe.intro,
    deny: {read: true}
  })

  const {state, objects} = await createContentState(
    db,
    policy,
    'config-release'
  )

  test.equal(Object.keys(state.entries), [entry.id])
  const projected = objects[state.entries[entry.id]].versions[0]
  test.is(projected.entry.parentId, null)
  test.equal(projected.entry.parents, [])
  test.not.ok('intro' in projected.entry.data)
  test.ok(projected.permissions & Permission.Read)
  test.ok(projected.permissions & Permission.Update)
  test.not.ok(projected.fieldPermissions.intro & Permission.Read)
})
