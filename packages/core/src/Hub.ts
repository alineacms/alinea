import {encode} from 'base64-arraybuffer'
import {Cursor} from 'helder.store'
import {Config} from './Config'
import {Entry} from './Entry'
import {Future} from './Future'
import {Media} from './Media'
import {User} from './User'
import {Workspaces} from './Workspace'

export interface Hub<T extends Workspaces = Workspaces> {
  config: Config<T>
  entry(id: string, stateVector?: Uint8Array): Future<Entry.Detail | null>
  list<K extends keyof T>(
    workspace: K,
    root: keyof T[K]['roots'],
    parentId?: string
  ): Future<Array<Entry.Summary>>
  query<T>(cursor: Cursor<T>): Future<Array<T>>
  updateDraft(id: string, update: Uint8Array): Future
  deleteDraft(id: string): Future
  uploadFile<K extends keyof T>(
    workspace: K,
    root: keyof T[K]['roots'],
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
    color?: string
  }
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
    list(workspace: string, root: string, parentId?: string) {
      return `/list/` + [workspace, root, parentId].filter(Boolean).join('/')
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
    query() {
      return `/query`
    },
    files(location?: string) {
      return `/files${location ? '/' + location : ''}`
    }
  }
}
