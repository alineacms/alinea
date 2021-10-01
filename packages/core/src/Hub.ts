import {Entry} from './Entry'
import {Schema} from './Schema'

export interface Content {
  get(id: string): Promise<Entry.WithParents | null>
  put(id: string, entry: Entry): Promise<void>
  list(parentId?: string): Promise<Array<Entry.WithChildrenCount>>
}

export interface Hub {
  schema: Schema
  content: Content
}
