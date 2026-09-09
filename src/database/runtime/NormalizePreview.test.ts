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
const Other = Config.document('Other', {
  fields: {title: Field.text('Title')},
  entryUrl({path}) {
    return `/other/${path}`
  }
})
const config = {
  schema: {Page, Other},
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

test('type and order previews preserve source-order ties without loading siblings or descendants', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-preview-structure-'))
  const file = join(directory, 'baseline.sqlite')
  const fixture = await createEntryResolver(config, [
    {id: 'first', type: 'Page', index: 'z', title: 'First'},
    {id: 'last', type: 'Page', index: 'a', title: 'Last'},
    {id: 'parent', type: 'Page', index: 'b', title: 'Parent'},
    {
      id: 'child',
      type: 'Page',
      index: 'c',
      parentPaths: ['parent'],
      title: 'Child'
    },
    {id: 'versions', type: 'Page', index: 'v', title: 'Published'},
    {id: 'versions', type: 'Page', index: 'v', title: 'Draft', status: 'draft'}
  ])
  try {
    {
      using sqlite = new Database(file)
      await buildDatabase(config, connect(sqlite), fixture.source, identity)
    }
    using sqlite = new Database(file, {readonly: true})
    const db = connect(sqlite)
    for (const id of ['first', 'last', 'parent', 'child']) {
      const original = fixture.index.findFirst(entry => entry.id === id)!
      for (const type of ['Page', 'Other']) {
        for (const index of ['a', 'b', 'z']) {
          const entry = {
            ...original,
            type,
            index,
            fileHash: `${id}-${type}-${index}`
          }
          const normalized = await normalizeEntryPreview(config, db, entry)
          expect(normalized.scanned).toBe(id === 'child' ? 2 : 1)
          expect(normalized.entries.every(row => row.entry.id === id)).toBe(
            true
          )
          const overlay = await NodeOverlay.open(
            config,
            file,
            identity,
            normalized.entries
          )
          try {
            for (const status of ['all', 'published', 'preferDraft'] as const) {
              const query = {status, select: Entry}
              expect(await overlay.find(query)).toEqual(
                await fixture.resolver.find({...query, preview: {entry}})
              )
            }
            const query = {
              id: 'parent',
              select: {url: Entry.url, children: children({select: Entry})}
            }
            expect(await overlay.find(query)).toEqual(
              await fixture.resolver.find({...query, preview: {entry}})
            )
          } finally {
            overlay.close()
          }
        }
      }
    }
    const original = fixture.index.findFirst(entry => entry.id === 'versions')!
    await expect(
      normalizeEntryPreview(config, db, {...original, index: 'a'})
    ).rejects.toThrow('Mismatched index')
    await expect(
      normalizeEntryPreview(config, db, {...original, type: 'Other'})
    ).rejects.toThrow('Mismatched types')
    await expect(
      normalizeEntryPreview(config, db, {...original, type: 'Missing'})
    ).rejects.toThrow('Unknown preview type')
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test.each(['published', 'draft', 'archived'] as const)(
  'new %s identity previews inherit parents and adopt only their physical subtree',
  async authoredStatus => {
    const directory = await mkdtemp(join(tmpdir(), 'alinea-preview-new-'))
    try {
      for (const nested of [false, true]) {
        const file = join(directory, `${nested}.sqlite`)
        const parent = {
          id: 'parent',
          type: 'Page',
          index: 'a',
          title: 'Parent',
          status: 'archived' as const
        }
        const parentPaths = nested ? ['parent'] : []
        const fixture = await createEntryResolver(config, [
          ...(nested ? [parent] : []),
          {
            id: 'child',
            type: 'Page',
            index: 'b',
            parentPaths: [...parentPaths, 'new'],
            title: 'Child'
          },
          {
            id: 'grandchild',
            type: 'Page',
            index: 'c',
            parentPaths: [...parentPaths, 'new', 'child'],
            title: 'Grandchild'
          },
          {
            id: 'neighbor',
            type: 'Page',
            index: 'b',
            parentPaths: [...parentPaths, 'newish'],
            title: 'Neighbor'
          },
          ...Array.from({length: 100}, (_, index) => ({
            id: `unrelated${index}`,
            type: 'Page',
            index: 'b',
            title: 'Unrelated'
          }))
        ])
        const inserted = await createEntryResolver(config, [
          ...(nested ? [parent] : []),
          {
            id: 'new',
            type: 'Page',
            index: 'b',
            parentPaths,
            title: 'New',
            status: authoredStatus
          }
        ])
        const entry = inserted.index.findFirst(entry => entry.id === 'new')!
        {
          using sqlite = new Database(file)
          await buildDatabase(config, connect(sqlite), fixture.source, identity)
        }
        using sqlite = new Database(file, {readonly: true})
        const db = connect(sqlite)
        const parse = spyOn(VersionParser.prototype, 'parse')
        let normalized
        try {
          normalized = await normalizeEntryPreview(config, db, entry)
          expect(parse).toHaveBeenCalledTimes(1)
          expect(normalized.scanned).toBe(nested ? 3 : 2)
          expect(new Set(normalized.entries.map(row => row.entry.id))).toEqual(
            new Set(['new', 'child', 'grandchild'])
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
              await fixture.resolver.find({...query, preview: {entry}})
            )
          }
          const query = {
            id: 'new',
            status: 'all' as const,
            select: {
              url: Entry.url,
              children: children({status: 'all', depth: 2, select: Entry})
            }
          }
          expect(await overlay.find(query)).toEqual(
            await fixture.resolver.find({...query, preview: {entry}})
          )
        } finally {
          overlay.close()
        }
        await expect(
          normalizeEntryPreview(config, db, {...entry, filePath: '../new.json'})
        ).rejects.toThrow('Invalid preview source path')
        const neighbor = fixture.index.findFirst(
          entry => entry.id === 'neighbor'
        )!
        await expect(
          normalizeEntryPreview(config, db, {
            ...entry,
            filePath: `${neighbor.childrenDir}.draft.json`
          })
        ).rejects.toThrow('directory belongs to another entry')
        await expect(
          normalizeEntryPreview(config, db, {...entry, id: 'neighbor'})
        ).rejects.toThrow('not in this checkpoint')
      }
      const empty = await createEntryResolver(config, [])
      const inserted = await createEntryResolver(config, [
        {id: 'new', type: 'Page', index: 'a', status: authoredStatus}
      ])
      const entry = inserted.index.findFirst(entry => entry.id === 'new')!
      const file = join(directory, 'empty.sqlite')
      {
        using sqlite = new Database(file)
        await buildDatabase(config, connect(sqlite), empty.source, identity)
      }
      using sqlite = new Database(file, {readonly: true})
      const normalized = await normalizeEntryPreview(
        config,
        connect(sqlite),
        entry
      )
      expect(normalized.scanned).toBe(0)
      expect(normalized.entries[0].entry.ordinal).toBe(0)
      const overlay = await NodeOverlay.open(
        config,
        file,
        identity,
        normalized.entries
      )
      try {
        expect(await overlay.find({status: 'all', select: Entry})).toEqual(
          await empty.resolver.find({
            status: 'all',
            select: Entry,
            preview: {entry}
          })
        )
      } finally {
        overlay.close()
      }
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  }
)
