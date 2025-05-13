import type {InferProjection, Projection} from 'alinea/core/Graph'
import type {EntryResolver, ResolveContext} from './EntryResolver.js'

export class LinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext
  ) {}

  includedAtBuild(filePath: string): boolean {
    return this.resolver.index.initialSync?.has(filePath) ?? false
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P> | undefined>> {
    /*const conditionStatus = statusChecker(this.ctx.status)
    const entries = Array<Entry>()
    for (const id of entryIds) {
      const node = this.resolver.index.byId.get(id)
      if (!node) continue
      const locale = node.locales.has(null) ? null : this.ctx.locale
      const versions = node.locales.get(locale ?? null)
      if (!versions) continue
      for (const version of versions.values()) {
        if (conditionStatus(version)) entries.push(version)
      }
    }
    const q = {select: projection}
    const results = entries.map((entry): any => {
      return this.resolver.select(this.ctx, entry, q)
    })
    await this.resolver.post({linkResolver: this}, results, q as any)
    return results*/
    const {locale, status, preview} = this.ctx
    const results = await this.resolver.resolve({
      preview: preview ? {entry: preview} : undefined,
      locale,
      status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<InferProjection<P> | undefined>
  }
}
