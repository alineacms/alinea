import {encode} from 'base64-arraybuffer'
import {Media} from '.'
import {Entry} from './Entry'
import {Future} from './Future'
import {Schema} from './Schema'
import {User} from './User'

export interface Hub<T = any> {
  schema: Schema<T>
  entry(id: string, stateVector?: Uint8Array): Future<Entry.Detail | null>
  list(parentId?: string): Future<Array<Entry.Summary>>
  updateDraft(id: string, update: Uint8Array): Future
  deleteDraft(id: string): Future
  uploadFile(file: Hub.Upload): Future<Media.File>
  publishEntries(entries: Array<Entry>): Future
}

export namespace Hub {
  export type Context = {user?: User}

  export type Upload = {path: string; buffer: ArrayBuffer}
  export type Stat = {
    size?: number
    lastModified?: Date
  }
  export type DirEntry = {type: 'file' | 'directory'; path: string; stat: Stat}

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
    },
    upload() {
      return `/upload`
    },
    files(location?: string) {
      return `/files${location ? '/' + location : ''}`
    }
  }
}
