import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Config as ConfigBuilder} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildEntryDatabase} from './BuildDatabase.js'
import {EntryDatabase} from './EntryDatabase.js'
import {runtimeDatabase} from './driver/RuntimeDatabase.js'

test('generated SQLite files reopen readonly and support overlays', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source} = await createEntryResolver(config, [
    {id: 'page', type: 'Page', index: 'a', data: {title: 'Page'}}
  ])
  const directory = await mkdtemp(join(tmpdir(), 'alinea-generated-db-'))
  const file = join(directory, 'database.sqlite')
  try {
    expect(await buildEntryDatabase(config, source, file)).toBeGreaterThan(0)
    const db = await runtimeDatabase({path: file, readonly: true})
    const base = new EntryDatabase(config, db, {searchReady: true})
    const overlay = await base.overlay(source)
    expect(await overlay.find({select: Entry.title})).toEqual(['Page'])
    expect(await overlay.find({search: 'Page', select: Entry.id})).toEqual([
      'page'
    ])
    await overlay.close()
    await base.close()
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
