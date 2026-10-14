import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'
import {DevDB} from './DevDB.js'
import {remoteLocations} from './MediaLocations.js'

const test = suite(import.meta)

function mediaEntry(id: string, location: string) {
  return JSON.stringify({
    _id: id,
    _type: 'MediaFile',
    _index: 'a0',
    title: id,
    location,
    extension: '.jpg'
  })
}

test('finds and fixes media locations that are urls', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-media-locations-'))
  const write = async (file: string, contents: string) => {
    await mkdir(dirname(join(rootDir, file)), {recursive: true})
    await writeFile(join(rootDir, file), contents)
  }
  let db: DevDB | undefined
  try {
    await write(
      'content/media/present.json',
      mediaEntry('present', 'https://files.example.com/uploads/photo.a1.jpg')
    )
    await write(
      'content/media/missing.json',
      mediaEntry('missing', 'https://files.example.com/uploads/gone.a2.jpg')
    )
    await write('content/media/local.json', mediaEntry('local', '/local.jpg'))
    await write('public/media/nested/photo.a1.jpg', 'image')
    await write('public/media/local.jpg', 'image')
    const config = Config.create({
      schema: {},
      workspaces: {
        main: Config.workspace('Main', {
          source: 'content',
          mediaDir: 'public/media',
          roots: {media: Config.media()}
        })
      }
    })
    db = await DevDB.create({
      config,
      rootDir,
      databasePath: join(rootDir, 'database.sqlite'),
      dashboardUrl: undefined
    })
    await db.sync()

    const found = await remoteLocations(rootDir, db)
    const byId = new Map(found.map(file => [file.id, file]))
    test.is(found.length, 2)
    test.is(byId.get('present')?.file, 'content/media/present.json')
    test.is(byId.get('present')?.local, '/nested/photo.a1.jpg')
    test.is(byId.get('missing')?.local, undefined)

    await db.fix()
    const fixed = JSON.parse(
      await readFile(join(rootDir, 'content/media/present.json'), 'utf8')
    )
    test.is(fixed.location, '/nested/photo.a1.jpg')
    const remaining = await remoteLocations(rootDir, db)
    test.equal(
      remaining.map(file => file.id),
      ['missing']
    )
  } finally {
    await db?.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})
