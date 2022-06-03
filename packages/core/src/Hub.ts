import {Cursor} from '@alinea/store'
import {encode} from 'base64-arraybuffer'
import {Config} from './Config'
import {Entry} from './Entry'
import {Future} from './Future'
import {Media} from './Media'
import {User} from './User'
import {Workspaces} from './Workspace'

export interface Hub<T extends Workspaces = Workspaces> {
  config: Config<T>
  entry(id: string, stateVector?: Uint8Array): Future<Entry.Detail | null>
  query<T>(cursor: Cursor<T>, options?: Hub.QueryOptions): Future<Array<T>>
  updateDraft(id: string, update: Uint8Array): Future
  deleteDraft(id: string): Future<boolean>
  listDrafts(workspace: string): Future<Array<{id: string}>>
  uploadFile(
    workspace: string,
    root: string,
    file: Hub.Upload
  ): Future<Media.File>
  publishEntries(entries: Array<Entry>): Future
}

export namespace Hub {
  export type Context = {user?: User}

  export type Upload = {
    path: string
    buffer: ArrayBuffer
    preview?: string
    averageColor?: string
    blurHash?: string
    width?: number
    height?: number
  }
  export type Stat = {
    size?: number
    lastModified?: Date
  }
  export type DirEntry = {type: 'file' | 'directory'; path: string; stat: Stat}
  export type QueryOptions = {
    /** Query source data, not drafts */
    source?: boolean
  }

  export const routes = {
    entry(id: string, stateVector?: Uint8Array) {
      const route = `/hub/entry/${id}`
      if (stateVector)
        return route + '?stateVector=' + encode(stateVector.buffer)
      return route
    },
    draft(id: string) {
      return `/hub/draft/${id}`
    },
    drafts() {
      return `/hub/draft`
    },
    publish() {
      return `/hub/publish`
    },
    upload() {
      return `/hub/upload`
    },
    query() {
      return `/hub/query`
    },
    files(location?: string) {
      return `/hub/files${location ? '/' + location : ''}`
    }
  }
}
