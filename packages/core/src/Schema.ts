import {Channel} from './Channel'
import {LazyRecord} from './util/LazyRecord'

export type Schema<T = any> = LazyRecord<Channel<T>>

type UnionOfValues<T> = T[keyof T]
type ChannelsToRows<T> = {[K in keyof T]: Channel.TypeOf<T[K]>}
type ChannelsToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {$channel: K}}>
  : never

export function createSchema<Channels extends LazyRecord<Channel>>(
  channels: Channels
): Schema<ChannelsToEntry<ChannelsToRows<Channels>>> {
  return channels
}

export namespace Schema {
  export const iterate = LazyRecord.iterate
  export function getChannel<T>(
    schema: Schema<T>,
    name: string
  ): Channel | undefined {
    return LazyRecord.get(schema, name)
  }
}
