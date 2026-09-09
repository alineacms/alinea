import {expect, test} from 'bun:test'
import {execFile} from 'node:child_process'
import {mkdtemp, readdir, rename, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {exportDatabase} from './ExportDatabase.js'

test('exports a self-contained checkpoint and relocatable loader readable by Node', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-export-'))
  const relocated = `${directory}-relocated`
  try {
    const identity = {
      configId: 'config-1',
      releaseId: 'release-1',
      namespace: 'main'
    }
    const size = await exportDatabase(
      cms.config,
      new FSSource('test/fixtures/demo'),
      directory,
      identity
    )
    expect(size).toBeGreaterThan(0)
    expect((await readdir(directory)).sort()).toEqual([
      'database.js',
      'release.sqlite'
    ])
    const {nodeFileTrace} = createRequire(import.meta.url)(
      'next/dist/compiled/@vercel/nft'
    ) as {
      nodeFileTrace(
        files: Array<string>,
        options: {base: string}
      ): Promise<{fileList: Set<string>}>
    }
    const trace = await nodeFileTrace([join(directory, 'database.js')], {
      base: directory
    })
    expect(
      [...trace.fileList].some(file => file.endsWith('release.sqlite'))
    ).toBe(true)
    await rename(directory, relocated)
    const {stdout} = await promisify(execFile)('node', [
      '--input-type=module',
      '-e',
      `
      import {DatabaseSync} from 'node:sqlite';
      const loader = await import(${JSON.stringify(pathToFileURL(join(relocated, 'database.js')).href)});
      const db = new DatabaseSync(loader.databasePath, {readOnly: true});
      console.log(JSON.stringify({identity: loader.identity, check: db.prepare('pragma integrity_check').get(), count: db.prepare('select count(*) as count from alinea_entry_index').get()}));
      db.close();
    `
    ])
    const result = JSON.parse(stdout)
    expect(result.identity).toEqual(identity)
    expect(result.check).toEqual({integrity_check: 'ok'})
    expect(result.count.count).toBeGreaterThan(0)
  } finally {
    await rm(directory, {recursive: true, force: true})
    await rm(relocated, {recursive: true, force: true})
  }
})
