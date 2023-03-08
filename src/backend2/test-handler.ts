import {nodeHandler} from 'alinea/backend/router/NodeHandler'
import {createConfig, root, schema, type, workspace} from 'alinea/core'
import {Logger, Report} from 'alinea/core/util/Logger'
import {path, text} from 'alinea/input'
import * as fs from 'node:fs/promises'
import http from 'node:http'
import {JWTPreviews} from '../backend.js'
import {Database} from './Database.js'
import {Handler} from './Handler.js'
import {SourceEntry} from './Source.js'
import {FileData} from './data/FileData.js'

const encode = (data: any) => new TextEncoder().encode(JSON.stringify(data))

const entry1: SourceEntry = {
  modifiedAt: Date.now(),
  workspace: 'main',
  root: 'data',
  filePath: 'index.json',
  contents: encode({
    id: 'root',
    type: 'Type',
    title: 'Test title',
    path: '/',
    url: '/',
    alinea: {
      index: 'a0',
      parent: undefined,
      parents: []
    }
  })
}

const entry2: SourceEntry = {
  modifiedAt: Date.now(),
  workspace: 'main',
  root: 'data',
  filePath: 'index/entry2.json',
  contents: encode({
    id: 'entry2',
    type: 'Type',
    title: 'Entry 2',
    path: '/entry2',
    url: '/entry2',
    alinea: {
      index: 'a0',
      parent: undefined,
      parents: []
    }
  })
}

const entry3: SourceEntry = {
  modifiedAt: Date.now(),
  workspace: 'main',
  root: 'data',
  filePath: 'index/entry2/entry3.json',
  contents: encode({
    id: 'entry3',
    type: 'Type',
    title: 'Entry 3',
    path: '/entry3',
    url: '/entry3',
    alinea: {
      index: 'a0',
      parent: undefined,
      parents: []
    }
  })
}

const config = createConfig({
  schema: schema({
    Type: type('Type', {
      title: text('Title'),
      path: path('Path')
    }).configure({
      isContainer: true
    })
  }),
  workspaces: {
    main: workspace('Main', {
      source: '.',
      roots: {
        data: root('Data', {
          contains: ['Type']
        }),
        media: root('Media', {
          contains: ['Type']
        })
      }
    })
  }
})

async function* files() {
  yield* [entry1, entry2, entry3]
}

async function boot() {
  const data = new FileData({
    config,
    fs,
    rootDir: './apps/web/content'
  })
  const {default: BetterSqlite3} = await import('better-sqlite3')
  const {connect} = await import('rado/driver/better-sqlite3')
  const store = connect(new BetterSqlite3('dist/test.db')).toAsync()
  const db = new Database(store, config)
  const logger = new Logger('test')
  await db.init()
  const endTimer = logger.time('fill')
  await db.fill(data.entries())
  endTimer()
  Report.toConsole(logger.report())
  console.log(await db.meta())

  const handler = new Handler({
    store,
    config,
    target: data,
    dashboardUrl: 'http://localhost:3000',
    media: undefined!,
    previews: new JWTPreviews('@alinea/backend/devserver')
  })

  http.createServer(nodeHandler(handler.handle)).listen(3000)

  console.log('Listening on port 3000')
}

boot().catch(console.error)
