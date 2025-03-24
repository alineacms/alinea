import type {LinkResolver} from 'alinea/backend/resolver/LinkResolver'

export interface PostProcess<Value> {
  (value: Value, loader: LinkResolver): Promise<void>
}
