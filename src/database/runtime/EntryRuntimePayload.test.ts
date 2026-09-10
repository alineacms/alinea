import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {config, entry} from '#test/sqlite-browser/config.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {entryVersionId} from '../entry/Schema.js'
import {EntryRuntime} from './EntryRuntime.js'

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} payload snapshots preserve exact identities, source revisions and detached values without hydration`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    let loads = 0
    try {
      await EntryRuntime.createSchema(db, 'empty')
      const runtime = new EntryRuntime(config, db, {
        async load() {
          loads++
          throw new Error('Unexpected hydration')
        }
      })
      const a = {
        versionId: entryVersionId('a', null, 'published'),
        payloadId: 'a1'
      }
      const b = {
        versionId: entryVersionId('b', null, 'published'),
        payloadId: 'b1'
      }
      await runtime.apply({
        fromRevision: 'empty',
        toRevision: 'r1',
        entries: [
          {
            entry: entry('a'),
            payloadId: a.payloadId,
            data: {title: 'A', nested: {value: 'original'}},
            source: {fileHash: 'source-a'}
          },
          {entry: entry('b'), payloadId: b.payloadId, data: {title: 'B'}}
        ]
      })
      const requests = [{...b}, {...a}],
        pending = runtime.payloadSnapshot(requests)
      requests[0].payloadId = 'caller-changed'
      const snapshot = await pending
      expect(snapshot.revision).toBe('r1')
      expect(snapshot.payloads.map(row => row.payloadId)).toEqual(['b1', 'a1'])
      snapshot.payloads[1].data.nested = 'caller-changed'
      snapshot.payloads[1].source!.fileHash = 'caller-changed'
      const again = await runtime.payloadSnapshot([a])
      expect(again.payloads[0].data.nested).toEqual({value: 'original'})
      expect(again.payloads[0].source!.fileHash).toBe('source-a')
      expect(await runtime.payloadSnapshot([])).toEqual({
        revision: 'r1',
        payloads: []
      })
      expect(() => runtime.payloadSnapshot([a, a])).toThrow('Invalid')
      expect(() => runtime.payloadSnapshot(Array(101).fill(a))).toThrow(
        'Too many'
      )
      await expect(
        runtime.payloadSnapshot([a, {...b, payloadId: 'stale'}])
      ).rejects.toThrow('stale')
      const replacing = runtime.apply({
        fromRevision: 'r1',
        toRevision: 'r2',
        entries: [{entry: entry('a'), payloadId: 'a2'}],
        removedVersionIds: [b.versionId]
      })
      const stale = runtime.payloadSnapshot([a]).catch(error => error as Error)
      await replacing
      expect(((await stale) as Error).message).toContain('stale')
      await expect(
        runtime.payloadSnapshot([{...a, payloadId: 'a2'}])
      ).rejects.toThrow('unavailable')
      await expect(runtime.payloadSnapshot([b])).rejects.toThrow('unavailable')
      expect(loads).toBe(0)
    } finally {
      db.close()
    }
  })
}
