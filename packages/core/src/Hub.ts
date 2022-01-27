import {encode} from 'base64-arraybuffer'
import {Entry} from './Entry'
import {Future} from './Future'
import {Schema} from './Schema'
import {User} from './User'

export interface Hub<T = any> {
  schema: Schema<T>
  entry(id: string, stateVector?: Uint8Array): Future<Entry.WithParents | null>
  list(parentId?: string): Future<Array<Entry.AsListItem>>
  updateDraft(id: string, update: Uint8Array): Future
  deleteDraft(id: string): Future
  publishEntries(entries: Array<Entry>): Future
}

export namespace Hub {
  export type Context = {user?: User}

  export const routes = {
    entry(id: string, stateVector?: Uint8Array) {
      const route = `/entry/${id}`
      if (stateVector)
        return route + '?stateVector=' + encode(stateVector.buffer)
      return route
    },
    list(parentId?: string) {
      return `/content.list${parentId ? '/' + parentId : ''}`
    },
    draft(id: string) {
      return `/draft/${id}`
    },
    publish() {
      return `/publish`
    }
  }
}
