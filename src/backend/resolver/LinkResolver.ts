import {Entry} from 'alinea/core/Entry'
import type {InferProjection, Projection} from 'alinea/core/Graph'
import {Status} from 'alinea/core/Graph'
import DataLoader from 'dataloader'
import {Store} from '../Store.js'
import type {EntryResolver} from './EntryResolver.js'
import {ResolveContext} from './ResolveContext.js'

export class LinkResolver {
  loaders = new Map<Projection, DataLoader<string, object>>()

  constructor(
    public resolver: EntryResolver,
    public store: Store,
    public status: Status
  ) {}

  load(projection: Projection) {
    return new DataLoader<string, object>(
      async (ids: ReadonlyArray<string>) => {
        const query = this.resolver.query(
          new ResolveContext({status: this.status}),
          {
            select: {
              entryId: Entry.entryId,
              projection: projection
            },
            filter: {_id: {in: ids}}
          }
        )
        const entries = (await query.all(this.store)) as Array<{
          entryId: string
          projection: any
        }>
        const results = new Map(
          entries.map(entry => [entry.entryId, entry.projection])
        )
        return ids.map(id => results.get(id) || {})
      }
    )
  }

  resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P> | undefined>> {
    if (this.loaders.has(projection))
      return this.loaders.get(projection)!.loadMany(entryIds).then(skipErrors)
    const loader = this.load(projection)
    this.loaders.set(projection, loader)
    return loader.loadMany(entryIds).then(skipErrors)

    function skipErrors(results: Array<any>) {
      return results.map(result => {
        if (result instanceof Error) {
          console.error(result)
          return undefined
        }
        return result
      })
    }
  }
}
