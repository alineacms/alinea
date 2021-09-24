import {Content, Hub} from '@alinea/core'
import {Schema} from '@alinea/core/Schema'
import {Index} from './Index'

export class LocalHub implements Hub {
  content: Content
  constructor(public schema: Schema, protected contentPath: string) {
    this.content = new Index(this.contentPath)
  }
}
