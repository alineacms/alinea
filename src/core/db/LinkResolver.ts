import type {InferProjection, Projection} from '#/core/Graph.js'
import type {Config} from '#/core/Config.js'

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
