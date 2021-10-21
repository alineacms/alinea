import {Collection} from 'helder.store'
import {Channel} from './Channel'
import {Entry} from './Entry'
import {LazyRecord} from './util/LazyRecord'

export type HasChannel = {$channel: string}

type UnionOfValues<T> = T[keyof T]
type ChannelsToRows<T> = {[K in keyof T]: Channel.TypeOf<T[K]> & Entry}
type ChannelsToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {$channel: K}}>
  : never

export type DataOf<T> = T extends Collection<infer U> ? U : never
export type EntryOf<T> = T extends Schema<infer U> ? U : never

export function createSchema<Channels extends LazyRecord<Channel>>(
  channels: Channels
): Schema<ChannelsToEntry<ChannelsToRows<Channels>>> {
  return new Schema(channels) as any
}

type ChannelsOf<T> = T extends HasChannel ? T['$channel'] : string

export class Schema<T = any> {
  #channels: LazyRecord<Channel<T>>
  constructor(channels: LazyRecord<Channel<T>>) {
    this.#channels = channels
  }

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.#channels)[Symbol.iterator]()
  }

  channel<K extends ChannelsOf<T>>(
    name: K
  ): Channel<Extract<T, {$channel: K}>> | undefined {
    return LazyRecord.get(this.#channels, name)
  }

  get keys() {
    return LazyRecord.keys(this.#channels)
  }

  get channels(): {
    [K in ChannelsOf<T>]: Collection<Extract<T, {$channel: K}>>
  } {
    return Object.fromEntries(
      Object.keys(this.#channels).map(name => {
        return [name, this.collection(name)]
      })
    ) as any
  }

  collection<K extends ChannelsOf<T>>(
    channel: K
  ): Collection<Extract<T, {$channel: K}>> {
    const alias = channel as string
    return new Collection('Entry', {
      where: Entry.as(alias).$channel.is(alias),
      alias
    })
  }
}
