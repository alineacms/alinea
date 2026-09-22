import {generatedDatabaseFile} from '#/core/Version.js'
import {expect, test} from 'bun:test'
import {mkdtemp, readdir, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {copyStaticFiles} from './CopyStaticFiles.js'
import type {GenerateContext} from './GenerateContext.js'

test('copying static files removes databases from other Alinea versions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-generated-'))
  const currentFiles = [
    generatedDatabaseFile,
    `${generatedDatabaseFile}-shm`,
    `${generatedDatabaseFile}-wal`
  ]
  const oldFiles = [
    'database.sqlite',
    'database-old-version.sqlite',
    'database-old-version.sqlite-shm',
    'database-old-version.sqlite-wal'
  ]
  try {
    await Promise.all(
      [...currentFiles, ...oldFiles].map(file =>
        writeFile(join(directory, file), '')
      )
    )

    await copyStaticFiles({outDir: directory} as GenerateContext)

    const files = await readdir(directory)
    expect(currentFiles.every(file => files.includes(file))).toBe(true)
    expect(oldFiles.every(file => !files.includes(file))).toBe(true)
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
