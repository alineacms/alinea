import type {InferProjection, Projection} from '#/core/Graph.js'
import type {Config} from '#/core/Config.js'
import type {EntryResolver, ResolveContext} from './EntryResolver.js'

/** Field postprocessors depend on query capabilities, not an index backend. */
export interface LinkResolver {
  resolver: {config: Config}
  locale: string | null
  includedAtBuild(filePath: string): boolean | Promise<boolean>
  resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P>>>
}

export class IndexedLinkResolver implements LinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext,
    public locale: string | null
  ) {}

  includedAtBuild(filePath: string): boolean {
    return this.resolver.index.initialSync?.has(filePath) ?? false
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P>>> {
    const {status, graph} = this.ctx
    const results = await this.resolver.resolve({
      graph,
      preferredLocale: this.locale ?? undefined,
      status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<InferProjection<P>>
  }
}
