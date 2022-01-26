import {Entry} from './Entry'
import {Outcome} from './Outcome'
import {Schema} from './Schema'

export interface Content {
  get(id: string): Promise<Entry.WithParents | null>
  // entryWithDraft(id: string): Promise<Entry.WithDraft | null>
  put(id: string, entry: Entry): Promise<Outcome<void>>
  // putDraft(id: string, doc: string): Promise<Outcome<void>>
  list(parentId?: string): Promise<Array<Entry.WithChildrenCount>>
  publish(entries: Array<Entry>): Promise<Outcome<void>>
}

export interface Drafts {
  get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Outcome<Uint8Array | undefined>>
  update(id: string, update: Uint8Array): Promise<void>
  delete(id: string): Promise<void>
}

export interface Hub<T = any> {
  schema: Schema<T>
  content: Content
  drafts: Drafts
}
