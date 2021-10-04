import {Entry} from './Entry'
import {Outcome} from './Outcome'
import {Schema} from './Schema'

export interface Content {
  get(id: string): Promise<Entry.WithParents | null>
  entryWithDraft(id: string): Promise<Entry.WithDraft | null>
  put(id: string, entry: Entry): Promise<Outcome<void>>
  putDraft(id: string, doc: string): Promise<Outcome<void>>
  list(parentId?: string): Promise<Array<Entry.WithChildrenCount>>
}

export interface Hub {
  schema: Schema
  content: Content
}
