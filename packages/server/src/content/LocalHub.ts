import {Schema} from '@alinea/core/Schema'
import {Index} from './Index'

export class LocalHub {
  constructor(public schema: Schema, protected contentPath: string) {}
  content = new Index(this.contentPath)
}
