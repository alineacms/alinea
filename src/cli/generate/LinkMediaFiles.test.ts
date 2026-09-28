import {
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile
} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'
import {DevDB} from './DevDB.js'
import {linkMediaFiles} from './LinkMediaFiles.js'

const test = suite(import.meta)

function mediaEntry(id: string, name: string) {
  return JSON.stringify({
    _id: id,
    _type: 'MediaFile',
    _index: 'a0',
    title: name,
    location: `/${name}.${id}.jpg`,
    extension: '.jpg'
  })
}

test('links media files on disk under their public file URL', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-link-media-'))
  const write = async (file: string, contents: string) => {
    await mkdir(dirname(join(rootDir, file)), {recursive: true})
    await writeFile(join(rootDir, file), contents)
  }
  let db: DevDB | undefined
  try {
    await write('content/media/present.json', mediaEntry('a1', 'present'))
    await write('content/media/missing.json', mediaEntry('a2', 'missing'))
    await write('public/media/present.a1.jpg', 'image')
    await write('public/admin/file/stale.jpg', 'stale')
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

    test.is(await linkMediaFiles(rootDir, db), 1)
    const link = join(rootDir, 'public/admin/file/present.jpg')
    test.is(await readlink(link), '../../media/present.a1.jpg')
    test.is(await readFile(link, 'utf8'), 'image')
    await test.throws(() =>
      readFile(join(rootDir, 'public/admin/file/missing.jpg'))
    )
    await test.throws(() =>
      readFile(join(rootDir, 'public/admin/file/stale.jpg'))
    )
  } finally {
    await db?.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})
