import type {LinkResolver} from '#/core/db/LinkResolver.js'

export interface PostProcess<Value> {
  (value: Value, loader: LinkResolver): Promise<void>
}
