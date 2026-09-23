import type {LocalConnection} from '#/core/Connection.js'
import type {User} from '#/core/User.js'
import {App} from '#/dashboard/App.js'
import {cms, db} from '#/dashboard/fixture/cms.ts?alinea'
import {LocalDB} from '#/database/LocalDB.js'
import {views} from '#/field/views.js'
import {Config, Field} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {use, useState} from 'react'
import {visualIds} from './VisualScenarioData.js'

const revisionTime = Date.UTC(2026, 2, 16, 9, 30)

const users: Array<User> = [
  {
    sub: 'fixture-user',
    name: 'Stijn Codeurs',
    email: 'stijn@example.com',
    roles: ['admin']
  },
  {
    sub: 'alice',
    name: 'Alice Editor',
    email: 'alice@example.com',
    roles: ['editor']
  },
  {
    sub: 'bob',
    name: 'Bob Reviewer',
    email: 'bob@example.com',
    roles: []
  }
]

// The dashboard fixture content (src/dashboard/fixture) covers most views:
// statuses, translations, nested trees, media and every common field type
export function FixtureScenario() {
  const [client] = useState((): LocalConnection => {
    const base = createTestConnection(db, {user: users[0], users})
    return {
      ...base,
      // The fixture plugin stamps revisions with the build time, pin them
      async revisions(file) {
        const revisions = await base.revisions(file)
        return revisions.map((revision, index) => ({
          ...revision,
          createdAt: revisionTime - index * 24 * 60 * 60 * 1000
        }))
      }
    }
  })
  return (
    <App
      client={client}
      config={cms.config}
      events={db.events}
      graph={db}
      local
      views={views}
    />
  )
}

const Tabbed = Config.type('Tabbed', {
  fields: {
    ...Field.tabs(
      Field.tab('Document', {
        fields: {
          title: Field.text('Title', {width: 0.5}),
          path: Field.path('Path', {width: 0.5}),
          blocks: Field.list('Blocks', {
            schema: {
              text: Config.type('Text', {
                fields: {text: Field.text('Text', {multiline: true})}
              }),
              heading: Config.type('Heading', {
                fields: {heading: Field.text('Heading')}
              }),
              quote: Config.type('Quote', {
                fields: {quote: Field.text('Quote')}
              }),
              video: Config.type('Video', {
                fields: {url: Field.text('Video URL')}
              })
            }
          })
        }
      }),
      Field.tab('Settings', {
        fields: {
          featured: Field.check('Featured'),
          summary: Field.text('Summary', {multiline: true})
        }
      })
    )
  }
})

function BrokenView(): never {
  throw new Error('This view failed to render')
}

// Renders the dashboard error boundary
const Broken = Config.type('Broken', {
  fields: {
    title: Field.text('Title'),
    ...Field.view(<BrokenView />)
  }
})

const fieldsConfig = Config.create({
  schema: {Tabbed, Broken},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'main',
      roots: {pages: Config.root('Pages', {contains: ['Tabbed', 'Broken']})}
    })
  }
})

async function createFieldsScenario() {
  const local = new LocalDB(fieldsConfig)
  await local.sync()
  await local.create({
    id: visualIds.tabbed,
    type: Tabbed,
    workspace: 'main',
    root: 'pages',
    set: {
      title: 'Tabbed page',
      blocks: [
        {_id: 'visual-block-1', _index: 'a0', _type: 'text', text: 'Intro'},
        {_id: 'visual-block-2', _index: 'a1', _type: 'quote', quote: 'Quote'}
      ]
    }
  })
  await local.create({
    id: visualIds.broken,
    type: Broken,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Broken page'}
  })
  return {client: createTestConnection(local), db: local}
}

// Tabs and a list with enough types for the type picker
export function FieldsScenario() {
  const [scenario] = useState(createFieldsScenario)
  const {client, db} = use(scenario)
  return (
    <App
      client={client}
      config={fieldsConfig}
      events={db.events}
      graph={db}
      local
      views={views}
    />
  )
}
