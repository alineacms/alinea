import type {InferProjection, Projection} from '#/core/Graph.js'
import type {EntryResolver, ResolveContext} from './EntryResolver.js'

export interface LinkTarget {
  entryId: string
  locale?: string
}

export class LinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext,
    public locale: string | null
  ) {}

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>,
    locale: string | null | undefined = this.locale
  ): Promise<Array<InferProjection<P>>> {
    const {status, graph} = this.ctx
    const results = await this.resolver.resolve({
      graph,
      preferredLocale: locale ?? undefined,
      status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<InferProjection<P>>
  }

  async resolveTargets<P extends Projection & {id: unknown}>(
    projection: P,
    targets: ReadonlyArray<LinkTarget>
  ): Promise<Array<InferProjection<P> | undefined>> {
    const targetsByLocale = new Map<string | undefined, Set<string>>()
    for (const {entryId, locale} of targets) {
      const entryIds = targetsByLocale.get(locale) ?? new Set<string>()
      entryIds.add(entryId)
      targetsByLocale.set(locale, entryIds)
    }
    const resultsByLocale = new Map<
      string | undefined,
      Map<string, InferProjection<P>>
    >()
    await Promise.all(
      Array.from(targetsByLocale, async ([locale, entryIds]) => {
        const results = await this.resolveLinks(
          projection,
          [...entryIds],
          locale
        )
        resultsByLocale.set(
          locale,
          new Map(results.map(result => [String(result.id), result]))
        )
      })
    )
    return targets.map(({entryId, locale}) =>
      resultsByLocale.get(locale)?.get(entryId)
    )
  }
}
