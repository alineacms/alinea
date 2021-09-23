import {Entry} from './Entry'
import {Schema} from './Schema'

export interface Content {
  get(path: string): Promise<Entry | null>
  list(parent?: string): Promise<Array<Entry & {children: number}>>
}

export interface Hub {
  schema: Schema
  content: Content
}
