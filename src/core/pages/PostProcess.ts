import type {LinkResolver} from 'alinea/core/db/LinkResolver'

export interface PostProcess<Value> {
  (value: Value, loader: LinkResolver): Promise<void>
}
