import {Permission, Policy} from '#/core/Role.js'
import {App} from '#/dashboard/App.js'
import {Config, Field} from '#/index.js'
import {views} from '#/field/views.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {LocalDB} from '#/database/LocalDB.js'
import {use} from 'react'

const Page = Config.document('Page', {
  fields: {title: Field.text('Title')}
})

const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: '.',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
    })
  }
})

async function createAccessDeniedScenario(policy: Policy) {
  const db = new LocalDB(config)
  await db.sync()
  db.createPolicy = async () => policy
  return {client: createTestConnection(db), db}
}

// Created once per page: a render that suspends before it mounts loses its
// state, so a promise kept in state would be created again on every retry
let denied: ReturnType<typeof createAccessDeniedScenario> | undefined
let userDenied: ReturnType<typeof createAccessDeniedScenario> | undefined

export function AccessDeniedScenario() {
  const {client, db} = use(
    (denied ??= createAccessDeniedScenario(Policy.ALLOW_NONE))
  )
  return (
    <App
      client={client}
      config={config}
      events={db.events}
      graph={db}
      local
      views={views}
    />
  )
}

export function UserAccessDeniedScenario() {
  const {client, db} = use(
    (userDenied ??= createAccessDeniedScenario(new Policy(Permission.Read)))
  )
  return (
    <App
      client={client}
      config={config}
      events={db.events}
      graph={db}
      local
      views={views}
    />
  )
}
