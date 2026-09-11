import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {createConfig} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {workspace} from '#/core/Workspace.js'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'
import {DevDB} from './DevDB.js'

const test = suite(import.meta)

test('rejects stale commits before removing media files', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-db-'))
  const mediaFile = join(rootDir, 'public/media/example.jpg')
  await mkdir(join(rootDir, 'content'), {recursive: true})
  await mkdir(dirname(mediaFile), {recursive: true})
  await writeFile(mediaFile, 'media')
  try {
    const config = createConfig({
      handlerUrl: '/api/cms',
      schema: {},
      workspaces: {
        main: workspace('Main', {
          source: 'content',
          mediaDir: 'public/media',
          roots: {}
        })
      }
    })
    const db = await DevDB.create({
      config,
      rootDir,
      databasePath: join(rootDir, 'database.sqlite'),
      dashboardUrl: undefined
    })
    await db.sync()
    const request: CommitRequest = {
      description: 'Stale media removal',
      fromSha: 'stale',
      intoSha: 'next',
      changes: [{op: 'removeFile', location: 'public/media/example.jpg'}]
    }

    await test.throws(() => db.write(request), 'SHA mismatch')
    test.is(await readFile(mediaFile, 'utf8'), 'media')
  } finally {
    await rm(rootDir, {recursive: true, force: true})
  }
})

test('reopens the generated database without loading unchanged blobs', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-db-reopen-'))
  const databasePath = join(rootDir, 'database.sqlite')
  const Page = Config.document('Page', {fields: {}})
  const config = createConfig({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    }
  })
  await mkdir(join(rootDir, 'content/pages'), {recursive: true})
  await writeFile(
    join(rootDir, 'content/pages/page.json'),
    JSON.stringify({_id: 'page', _type: 'Page', _index: 'a', title: 'Page'})
  )
  try {
    const initial = await DevDB.create({
      config,
      rootDir,
      databasePath,
      dashboardUrl: undefined
    })
    await initial.sync()
    test.equal(await initial.find({select: Entry.title}), ['Page'])
    await initial.close()

    const reopened = await DevDB.create({
      config,
      rootDir,
      databasePath,
      dashboardUrl: undefined
    })
    let requestedBlobs = 0
    const getBlobs = reopened.source.getBlobs.bind(reopened.source)
    reopened.source.getBlobs = async function* (shas, options) {
      requestedBlobs += shas.length
      yield* getBlobs(shas, options)
    }
    await reopened.sync()
    test.is(requestedBlobs, 0)
    test.equal(await reopened.find({select: Entry.title}), ['Page'])
    await reopened.close()
  } finally {
    await rm(rootDir, {recursive: true, force: true})
  }
})
