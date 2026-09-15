import type {InferProjection, Projection} from '#/core/Graph.js'
import type {Config} from '#/core/Config.js'

export interface LinkTarget {
  entryId: string
  locale?: string
}

/** Field postprocessors depend on query capabilities, not an index backend. */
export interface LinkResolver {
  resolver: {config: Config}
  locale: string | null
  includedAtBuild(filePath: string): boolean | Promise<boolean>
  resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>,
    locale?: string | null
  ): Promise<Array<InferProjection<P>>>
  resolveTargets<P extends Projection & {id: unknown}>(
    projection: P,
    targets: ReadonlyArray<LinkTarget>
  ): Promise<Array<InferProjection<P> | undefined>>
}
