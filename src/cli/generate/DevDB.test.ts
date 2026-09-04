import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {createConfig} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {workspace} from '#/core/Workspace.js'
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
    const db = new DevDB({config, rootDir, dashboardUrl: undefined})
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
