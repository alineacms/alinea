import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {role} from '#/core/Role.js'
import {config, entry, Page} from '#test/sqlite-browser/config.js'
import {entryVersionId} from '../entry/Schema.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {EmbeddingStore} from '../vector/EmbeddingStore.js'
import type {EmbeddingSpace, EmbeddingTarget} from '../vector/Embedding.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {authorizedIndex} from './Policy.js'
import {AuthorizedEmbeddingSearch} from './EmbeddingSearch.js'

const space: EmbeddingSpace = {
  provider: 'fixture',
  model: 'model',
  revision: '1',
  preprocessing: 'text',
  dimensions: 2,
  encoding: 'float32-le',
  metric: 'cosine'
}
const version = (id: string) => entryVersionId(id, null, 'published')
function target(id: string, payloadId = id): EmbeddingTarget {
  return {
    owner: {versionId: version(id), kind: 'entry'},
    ownerPayloadId: payloadId,
    slot: 'semantic',
    chunk: 'main',
    sourceHash: 'a'.repeat(40),
    space
  }
}

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} embedding search filters owner permissions before top-k and rejects stale inputs`, async () => {
    // The stores have independent connections; the runtime read generation guards
    // source changes while the embedding store pins its own derived revision.
    const source =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    const vectors =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EntryRuntime.createSchema(source, 'empty')
      await EmbeddingStore.createSchema(vectors)
      let revoked = false
      const runtime = new EntryRuntime(
        {
          ...config,
          roles: {
            reader: role('Reader', {
              permissions(policy) {
                policy
                  .allowAll()
                  .set(
                    {id: 'denied', deny: {read: true}},
                    {id: 'hidden', deny: {explore: true}}
                  )
                if (revoked) policy.set({id: 'readable', deny: {read: true}})
              }
            }),
            restricted: role('Restricted', {
              permissions(policy) {
                policy.allowAll().set({field: Page.title, deny: {read: true}})
              }
            })
          }
        },
        source,
        {
          load() {
            throw new Error('Vector selection must not hydrate entries')
          }
        }
      )
      await runtime.apply({
        fromRevision: 'empty',
        toRevision: 'r1',
        entries: ['readable', 'denied', 'hidden', 'missing'].map(id => ({
          entry: entry(id),
          payloadId: id
        }))
      })
      const embeddings = new EmbeddingStore(vectors)
      for (const id of ['readable', 'denied', 'hidden']) {
        const job = await embeddings.schedule(target(id))
        await embeddings.install(job, id === 'readable' ? [0, 1] : [1, 0])
      }
      const service = new AuthorizedEmbeddingSearch(runtime, embeddings)
      const view = await authorizedIndex(runtime, ['reader'])
      const query = {
        revision: view.revision,
        viewId: view.viewId,
        embeddingRevision: await embeddings.revision(),
        ownerVersionIds: ['readable', 'denied', 'hidden', 'unknown'].map(
          version
        ),
        space,
        slot: 'semantic',
        vector: [1, 0],
        limit: 1
      }
      const result = await service.search(['reader'], query)
      expect(result.matches.map(match => match.owner.versionId)).toEqual([
        version('readable')
      ])
      expect(result.matches[0].distance).toBe(1)
      expect(result.candidates).toBe(1)
      expect(JSON.stringify(result)).not.toContain('denied')
      expect(JSON.stringify(result)).not.toContain('hidden')
      // An inaccessible owner's corrupt payload must not affect permitted results.
      const hidden = await embeddings.schedule(target('hidden'))
      const payload = (await embeddings.manifest(hidden.id))!.payloadId
      await vectors.execute(
        sql`UPDATE alinea_embedding_data SET bytes = ${new Uint8Array(1)} WHERE id = ${payload}`
      )
      expect((await service.search(['reader'], query)).matches).toEqual(
        result.matches
      )
      await expect(
        service.search(['reader'], {
          ...query,
          ownerVersionIds: [version('missing')]
        })
      ).rejects.toThrow('not fully indexed')
      await expect(
        service.search(['reader'], {...query, viewId: 'old'})
      ).rejects.toThrow('Stale embedding policy view')
      await expect(service.search(['restricted'], query)).rejects.toThrow(
        'Field-level read restrictions'
      )
      const denied = await authorizedIndex(runtime, [])
      expect(
        (await service.search([], {...query, viewId: denied.viewId})).matches
      ).toEqual([])

      revoked = true
      await expect(service.search(['reader'], query)).rejects.toThrow(
        'Stale embedding policy view'
      )
      const revokedView = await authorizedIndex(runtime, ['reader'])
      expect(revokedView.revision).toBe(query.revision)
      expect(
        (
          await service.search(['reader'], {
            ...query,
            viewId: revokedView.viewId
          })
        ).matches
      ).toEqual([])
      revoked = false

      await runtime.apply({
        fromRevision: 'r1',
        toRevision: 'r2',
        entries: [{entry: entry('readable'), payloadId: 'readable-v2'}]
      })
      await expect(service.search(['reader'], query)).rejects.toThrow(
        'Stale embedding policy view'
      )
      const fresh = await authorizedIndex(runtime, ['reader'])
      const nextQuery = {
        ...query,
        revision: fresh.revision,
        viewId: fresh.viewId,
        ownerVersionIds: [version('readable')]
      }
      await expect(service.search(['reader'], nextQuery)).rejects.toThrow(
        'inputs are stale'
      )
      const replacement = await embeddings.schedule(
        target('readable', 'readable-v2')
      )
      await expect(
        service.search(['reader'], {
          ...nextQuery,
          embeddingRevision: await embeddings.revision()
        })
      ).rejects.toThrow('not fully embedded')
      await embeddings.install(replacement, [-1, 0])
      expect(
        (
          await service.search(['reader'], {
            ...nextQuery,
            embeddingRevision: await embeddings.revision()
          })
        ).matches[0].distance
      ).toBe(2)
    } finally {
      source.close()
      vectors.close()
    }
  })
}
