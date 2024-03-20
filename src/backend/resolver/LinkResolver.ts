import {Entry} from 'alinea/core/Entry'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import type {Projection} from 'alinea/core/pages/Projection'
import {Realm} from 'alinea/core/pages/Realm'
import {serializeSelection} from 'alinea/core/pages/Serialize'
import DataLoader from 'dataloader'
import {Query} from 'rado'
import {Store} from '../Store.js'
import type {EntryResolver} from './EntryResolver.js'
import {ResolveContext} from './ResolveContext.js'

interface LinkData {
  entryId: string
  projection: any
}

export class LinkResolver {
  loaders = new Map<Projection, DataLoader<string, object>>()

  constructor(
    public resolver: EntryResolver,
    public store: Store,
    public realm: Realm
  ) {}

  load(projection: Projection) {
    return new DataLoader<string, object>(
      async (ids: ReadonlyArray<string>) => {
        const selection = createSelection(
          Entry().where(Entry.entryId.isIn(ids)).select({
            entryId: Entry.entryId,
            projection: projection
          })
        )
        serializeSelection(this.resolver.targets, selection)
        const query = new Query<Array<LinkData>>(
          this.resolver.query(
            new ResolveContext({realm: this.realm}),
            selection
          )
        )
        const entries = await this.store(query)
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
  ): Promise<Array<Projection.Infer<P> | undefined>> {
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
