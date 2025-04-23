import type {InferProjection, Projection} from 'alinea/core/Graph'
import type {EntryResolver, ResolveContext} from './EntryResolver.js'

export class LinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext
  ) {}

  resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P> | undefined>> {
    return this.resolver.resolve({
      select: projection,
      status: this.ctx.status,
      id: {in: entryIds}
    }) as any
  }
}
