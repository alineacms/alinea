import type {InferProjection, Projection} from '#/core/Graph.js'
import type {Config} from '#/core/Config.js'
import type {RootI18n} from '#/core/Root.js'

export interface LinkTarget {
  entryId: string
  locale?: string
}

/** Field postprocessors depend on query capabilities, not an index backend. */
export interface LinkResolver {
  config: Config
  locale: string | null
  /** The locales of the root of the entry being read, if it translates fields */
  fieldI18n?: RootI18n
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
