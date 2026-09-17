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
  let db: DevDB | undefined
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
    const created = await DevDB.create({
      config,
      rootDir,
      databasePath: join(rootDir, 'database.sqlite'),
      dashboardUrl: undefined
    })
    db = created
    await created.sync()
    const request: CommitRequest = {
      description: 'Stale media removal',
      fromSha: 'stale',
      intoSha: 'next',
      changes: [{op: 'removeFile', location: 'public/media/example.jpg'}]
    }

    await test.throws(() => created.write(request), 'SHA mismatch')
    test.is(await readFile(mediaFile, 'utf8'), 'media')
  } finally {
    await db?.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})

test('reopens the generated database without loading unchanged blobs', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-db-reopen-'))
  const databasePath = join(rootDir, 'database.sqlite')
  let initial: DevDB | undefined
  let reopened: DevDB | undefined
  let changedConfig: DevDB | undefined
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
    initial = await DevDB.create({
      config,
      rootDir,
      databasePath,
      configFingerprint: 'same-config',
      dashboardUrl: undefined
    })
    await initial.sync()
    test.equal(await initial.find({select: Entry.title}), ['Page'])
    await initial.close()

    reopened = await DevDB.create({
      config,
      rootDir,
      databasePath,
      configFingerprint: 'same-config',
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

    changedConfig = await DevDB.create({
      config,
      rootDir,
      databasePath,
      configFingerprint: 'changed-config',
      dashboardUrl: undefined
    })
    let reloadedBlobs = 0
    const changedGetBlobs = changedConfig.source.getBlobs.bind(
      changedConfig.source
    )
    changedConfig.source.getBlobs = async function* (shas, options) {
      reloadedBlobs += shas.length
      yield* changedGetBlobs(shas, options)
    }
    await changedConfig.sync()
    test.ok(reloadedBlobs > 0)
    test.equal(await changedConfig.find({select: Entry.title}), ['Page'])
    await changedConfig.close()
  } finally {
    await changedConfig?.close()
    await reopened?.close()
    await initial?.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})

test('prepares uploads on the development server origin', async () => {
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
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-db-upload-'))
  let db: DevDB | undefined
  try {
    db = await DevDB.create({
      config,
      rootDir,
      databasePath: join(rootDir, 'database.sqlite'),
      dashboardUrl: 'http://localhost:4500'
    })

    const upload = await db.prepareUpload('public/media/example.png')

    test.is(upload.url.startsWith('http://localhost:4500/?/upload&file='), true)
  } finally {
    await db?.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})
