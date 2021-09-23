import {Channel} from './Channel'
import {LazyRecord} from './util/LazyRecord'

export class Schema {
  constructor(public channels: LazyRecord<Channel>) {}

  getChannel(name: string): Channel | undefined {
    return LazyRecord.get(this.channels, name)
  }
}
