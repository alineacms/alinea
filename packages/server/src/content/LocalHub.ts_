import {Content, Hub} from '@alinea/core'
import {Schema} from '@alinea/core/Schema'
import {Persistence} from '../Persistence'
import {Cache} from './cache/Cache'
import {IndexedContent} from './IndexedContent'

export type LocalHubOptions<T> = {
  schema: Schema<T>
  index: Cache
  persistence: Persistence
}

export class LocalHub<T> implements Hub<T> {
  schema: Schema<T>
  content: Content
  constructor(protected options: LocalHubOptions<T>) {
    this.schema = options.schema
    this.content = new IndexedContent(options.index, options.persistence)
  }
}
