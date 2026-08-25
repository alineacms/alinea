import type {InferProjection, Projection, Status} from '#/core/Graph.js'
import type {Resolver} from '#/core/Resolver.js'

export interface LinkResolverContext {
  status: Status
}

export interface LinkResolverOptions {
  includedAtBuild?(filePath: string): boolean
}

export interface LinkResolverTarget extends Resolver {
  config: Config
}

export class LinkResolver {
  constructor(
    public resolver: LinkResolverTarget,
    private ctx: LinkResolverContext,
    public locale: string | null,
    private options: LinkResolverOptions = {}
  ) {}

  includedAtBuild(filePath: string): boolean {
    return this.options.includedAtBuild?.(filePath) ?? false
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P>>> {
    const {status} = this.ctx
    const results = await this.resolver.resolve({
      preferredLocale: this.locale ?? undefined,
      status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<InferProjection<P>>
  }
}
import type {Config} from '#/core/Config.js'
