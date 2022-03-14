import {
  Collection,
  Cursor,
  Functions,
  SelectionInput,
  Store
} from '@alinea/store'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export enum EntryStatus {
  Draft = 'draft',
  Published = 'published',
  Publishing = 'publishing',
  Archived = 'archived'
}

export interface Entry {
  id: string
  type: string
  title: Label
  index: string
  // Computed properties
  workspace: string
  root: string
  url: string
  $status?: EntryStatus
  parent?: string
  parents: Array<string>
  $isContainer?: boolean
}

export namespace Entry {
  export type Detail = {
    entry: Entry
    draft: string | undefined
    previewToken: string
  }
  export type Minimal = Pick<
    Entry,
    'id' | 'type' | 'workspace' | 'root' | 'url'
  >
  export type Summary = Pick<
    Entry,
    | 'id'
    | 'type'
    | 'title'
    | 'index'
    | 'workspace'
    | 'root'
    | 'url'
    | 'parent'
    | 'parents'
    | '$isContainer'
  > & {
    childrenCount: number
  }
  export type Raw = Omit<
    Entry,
    | 'workspace'
    | 'root'
    | 'url'
    | '$status'
    | 'parent'
    | 'parents'
    | '$isContainer'
  >
}

export const Entry = new Collection<Entry>('Entry')

export function selectParents<S extends SelectionInput, E extends Entry>(
  Entry: Collection<E>,
  selection: (Parent: Collection<Entry>) => S
): Cursor<Store.TypeOf<S>> {
  const Parent = Entry.as('Parent') as unknown as Collection<Entry>
  return Parent.where(Parent.id.isIn(Entry.get('parents')))
    .orderBy(Functions.arrayLength(Parent.parents).asc())
    .select(selection(Parent))
}
