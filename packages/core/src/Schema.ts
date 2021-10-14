import {Channel} from './Channel'
import {Entry} from './Entry'
import {LazyRecord} from './util/LazyRecord'

type UnionOfValues<T> = T[keyof T]
type ChannelsToRows<T> = {[K in keyof T]: Channel.TypeOf<T[K]> & Entry}
type ChannelsToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {$channel: K}}>
  : never

export function createSchema<Channels extends LazyRecord<Channel>>(
  channels: Channels
): Schema<ChannelsToEntry<ChannelsToRows<Channels>>> {
  return new Schema(channels)
}

export class Schema<T extends {$channel: string} = Entry> {
  constructor(public channels: LazyRecord<Channel<T>>) {}

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.channels)[Symbol.iterator]()
  }

  channel<K extends T['$channel']>(
    name: K
  ): Channel<Extract<T, {$channel: K}>> | undefined {
    return LazyRecord.get(this.channels, name)
  }
}
