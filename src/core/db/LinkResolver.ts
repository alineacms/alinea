import type {InferProjection, Projection} from 'alinea/core/Graph'
import type {EntryResolver, ResolveContext} from './EntryResolver.js'

export class LinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext,
    private locale: string | null
  ) {}

  includedAtBuild(filePath: string): boolean {
    return this.resolver.index.initialSync?.has(filePath) ?? false
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P> | undefined>> {
    const {status, preview} = this.ctx
    const results = await this.resolver.resolve({
      preview: preview ? {entry: preview} : undefined,
      preferredLocale: this.locale ?? undefined,
      status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<InferProjection<P> | undefined>
  }
}
