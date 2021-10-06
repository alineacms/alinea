import {Content, Hub} from '@alinea/core'
import {Schema} from '@alinea/core/Schema'
import {ContentIndex} from './ContentIndex'

export class LocalHub implements Hub {
  content: Content
  constructor(public schema: Schema, protected contentPath: string) {
    this.content = new ContentIndex(this.contentPath)
  }
}
