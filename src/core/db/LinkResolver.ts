import type {InferProjection, Projection} from 'alinea/core/Graph'
import type {Entry} from '../Entry.js'
import {
  type EntryResolver,
  type ResolveContext,
  conditionStatus
} from './EntryResolver.js'

export class LinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext
  ) {}

  resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P> | undefined>> {
    const entries = Array<Entry>()
    for (const id of entryIds) {
      const node = this.resolver.index.byId.get(id)
      if (!node) continue
      const versions = node.locales.get(this.ctx.locale ?? null)
      if (!versions) continue
      for (const version of versions.values()) {
        if (conditionStatus(version, this.ctx.status)) entries.push(version)
      }
    }
    return this.resolver.resolve({select: projection}, entries) as any
  }
}
