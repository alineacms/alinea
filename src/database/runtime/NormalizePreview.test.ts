import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {connect} from 'rado/driver/bun-sqlite'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {VersionParser} from '#/core/db/EntryIndex.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {children} from '#/query.js'
import {NodeOverlay} from '../driver/NodeOverlay.js'
import {buildDatabase} from './BuildDatabase.js'
import {normalizeEntryPreview} from './NormalizePreview.js'

const Page = Config.document('Page', {
  fields: {title: Field.text('Title')},
  entryUrl({data, path, parentPaths}) {
    return `/${parentPaths.join('/')}/${path}/${data.title}`
  }
})
const config = {
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
}
const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

test.each(['published', 'archived'] as const)(
  'preview normalization reconstructs only related versions under a %s ancestor',
  async ancestorStatus => {
    const directory = await mkdtemp(join(tmpdir(), 'alinea-preview-normalize-'))
    const file = join(directory, 'baseline.sqlite')
    const fixture = await createEntryResolver(config, [
      {
        id: 'ancestor',
        type: 'Page',
        index: 'a',
        title: 'Ancestor',
        status: ancestorStatus
      },
      {
        id: 'edited',
        type: 'Page',
        index: 'b',
        parentPaths: ['ancestor'],
        title: 'Published'
      },
      {
        id: 'edited',
        type: 'Page',
        index: 'b',
        parentPaths: ['ancestor'],
        title: 'Draft',
        status: 'draft'
      },
      {
        id: 'child',
        type: 'Page',
        index: 'c',
        parentPaths: ['ancestor', 'edited'],
        title: 'Child'
      },
      ...Array.from({length: 100}, (_, index) => ({
        id: `unrelated-${index}`,
        type: 'Page',
        index: index === 0 ? 'b' : 'd',
        title: `Unrelated ${index}`
      }))
    ])
    try {
      {
        using sqlite = new Database(file)
        await buildDatabase(config, connect(sqlite), fixture.source, identity)
      }
      for (const [id, status] of [
        ['edited', 'published'],
        ['edited', 'draft'],
        ['ancestor', 'published']
      ] as const) {
        const original = Array.from(
          fixture.index.filter({includeHiddenVersions: true})
        ).find(
          entry =>
            entry.id === id &&
            entry.filePath.endsWith('.draft.json') === (status === 'draft')
        )!
        const preview = {
          entry: {
            ...original,
            fileHash: `preview-${id}-${status}`,
            data: {...original.data, title: `Preview ${status}`}
          }
        }
        using sqlite = new Database(file, {readonly: true})
        const db = connect(sqlite)
        const parse = spyOn(VersionParser.prototype, 'parse')
        let normalized
        try {
          normalized = await normalizeEntryPreview(config, db, preview.entry)
          expect(normalized.scanned).toBe(id === 'ancestor' ? 1 : 3)
          expect(parse).toHaveBeenCalledTimes(1)
          expect(normalized.entries.every(row => row.entry.id === id)).toBe(
            true
          )
        } finally {
          parse.mockRestore()
        }
        const overlay = await NodeOverlay.open(
          config,
          file,
          identity,
          normalized.entries
        )
        try {
          for (const status of [
            'all',
            'published',
            'draft',
            'archived',
            'preferDraft',
            'preferPublished'
          ] as const) {
            const query = {status, select: Entry}
            expect(await overlay.find(query)).toEqual(
              await fixture.resolver.find({...query, preview})
            )
          }
          const query = {
            id: 'ancestor',
            select: {title: Entry.title, children: children({select: Entry})}
          }
          expect(await overlay.find(query)).toEqual(
            await fixture.resolver.find({...query, preview})
          )
        } finally {
          overlay.close()
        }
        await expect(
          normalizeEntryPreview(config, db, {
            ...preview.entry,
            index: 'different'
          })
        ).rejects.toThrow('Structural preview')
        await expect(
          normalizeEntryPreview(config, db, {...preview.entry, id: 'missing'})
        ).rejects.toThrow('belongs to another entry')
      }
      for (const [id, status] of [
        ['edited', 'archived'],
        ['ancestor', 'draft']
      ] as const) {
        const original = Array.from(
          fixture.index.filter({includeHiddenVersions: true})
        ).find(entry => entry.id === id)!
        const preview = {
          entry: {
            ...original,
            status,
            filePath: `${original.childrenDir}.${status}.json`,
            fileHash: `added-${id}-${status}-${ancestorStatus}`,
            data: {...original.data, title: `Added ${status}`}
          }
        }
        using sqlite = new Database(file, {readonly: true})
        const normalized = await normalizeEntryPreview(
          config,
          connect(sqlite),
          preview.entry
        )
        expect(normalized.scanned).toBe(4)
        expect(
          normalized.entries.some(
            row => row.source?.filePath === preview.entry.filePath
          )
        ).toBe(true)
        const overlay = await NodeOverlay.open(
          config,
          file,
          identity,
          normalized.entries
        )
        try {
          for (const status of [
            'all',
            'published',
            'draft',
            'archived',
            'preferDraft',
            'preferPublished'
          ] as const) {
            const query = {status, select: Entry}
            expect(await overlay.find(query)).toEqual(
              await fixture.resolver.find({...query, preview})
            )
          }
        } finally {
          overlay.close()
        }
      }
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  }
)
