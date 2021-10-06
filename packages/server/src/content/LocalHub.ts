import {Content, Hub} from '@alinea/core'
import {Schema} from '@alinea/core/Schema'
import {ContentIndex} from './ContentIndex'

export type LocalHubOptions = {
  schema: Schema
  contentPath: string
  cachePath?: string
}

export class LocalHub implements Hub {
  content: Content
  schema: Schema
  constructor(protected options: LocalHubOptions) {
    this.schema = options.schema
    this.content = new ContentIndex(options.contentPath, options.cachePath)
  }
}
