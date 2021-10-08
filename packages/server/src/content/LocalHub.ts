import {Content, Hub} from '@alinea/core'
import {Schema} from '@alinea/core/Schema'
import {ContentIndex} from '@alinea/index'
import {Persistence} from '../Persistence'
import {IndexedContent} from './IndexedContent'

export type LocalHubOptions = {
  schema: Schema
  index: ContentIndex
  persistence: Persistence
}

export class LocalHub implements Hub {
  schema: Schema
  content: Content
  constructor(protected options: LocalHubOptions) {
    this.schema = options.schema
    this.content = new IndexedContent(options.index, options.persistence)
  }
}
