import {Policy} from '#/core/Role.js'
import {App} from '#/dashboard/App.js'
import {Config, Field} from '#/index.js'
import {views} from '#/field/views.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {use, useState} from 'react'

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

async function createAccessDeniedScenario() {
  const db = new SourceDB(config)
  await db.sync()
  db.createPolicy = async () => Policy.ALLOW_NONE
  return {client: createTestConnection(db), db}
}

export function AccessDeniedScenario() {
  const [scenario] = useState(createAccessDeniedScenario)
  const {client, db} = use(scenario)
  return (
    <App
      client={client}
      config={config}
      events={db.index}
      graph={db}
      local
      views={views}
    />
  )
}
