import {Changes} from '@alinea/backend/Storage'
import {base64url} from '@alinea/core/util/Encoding'
import {Cursor} from '@alinea/store'
import {Config} from './Config'
import {Entry} from './Entry'
import {Future} from './Future'
import {Media} from './Media'
import {User} from './User'
import {Logger} from './util/Logger'
import {Workspaces} from './Workspace'

export interface Hub<T extends Workspaces = Workspaces> {
  config: Config<T>
  entry(params: Hub.EntryParams, ctx?: Hub.Context): Future<Entry.Detail | null>
  query<T>(params: Hub.QueryParams<T>, ctx?: Hub.Context): Future<Array<T>>
  updateDraft(params: Hub.UpdateParams, ctx?: Hub.Context): Future
  deleteDraft(params: Hub.DeleteParams, ctx?: Hub.Context): Future<boolean>
  listDrafts(
    params: Hub.ListParams,
    ctx?: Hub.Context
  ): Future<Array<{id: string}>>
  uploadFile(params: Hub.UploadParams, ctx?: Hub.Context): Future<Media.File>
  publishEntries(params: Hub.PublishParams, ctx?: Hub.Context): Future
}

export namespace Hub {
  export interface AuthContext {
    user?: User
    token?: string
    // Eventually we'll probably want to enable preview hashes that specify
    // exactly which drafts we'd like to see. For now we'll just add in the
    // entry id we're previewing.
    preview?: string
  }
  export interface Context extends AuthContext {
    logger: Logger
  }
  export type EntryParams = {
    id: string
    stateVector?: Uint8Array
  }
  export type QueryParams<T> = {
    cursor: Cursor<T>
    /** Query source data, not drafts */
    source?: boolean
  }
  export type UpdateParams = {
    id: string
    update: Uint8Array
  }
  export type DeleteParams = {
    id: string
  }
  export type DeleteMultipleParams = {
    ids: Array<string>
  }
  export type ListParams = {
    workspace: string
  }
  export type UploadParams = {
    parentId: string | undefined
    workspace: string
    root: string
    path: string
    buffer: ArrayBuffer
    preview?: string
    averageColor?: string
    blurHash?: string
    width?: number
    height?: number
  }
  export type MediaUploadParams = {
    buffer: ArrayBuffer
    fileLocation: string
  }
  export type DownloadParams = {
    location: string
  }
  export type Download =
    | {type: 'buffer'; buffer: ArrayBuffer}
    | {type: 'url'; url: string}
  export type PublishParams = {
    entries: Array<Entry>
  }
  export type ChangesParams = {
    changes: Changes
  }

  const base = '/hub'
  export const routes = {
    base,
    entry(id: string, stateVector?: Uint8Array) {
      const route = base + `/entry/${id}`
      if (stateVector)
        return route + '?stateVector=' + base64url.stringify(stateVector)
      return route
    },
    draft(id: string) {
      return base + `/draft/${id}`
    },
    drafts() {
      return base + `/draft`
    },
    publish() {
      return base + `/publish`
    },
    upload() {
      return base + `/upload`
    },
    query() {
      return base + `/query`
    },
    files(location?: string) {
      return base + `/files${location ? '/' + location : ''}`
    }
  }
}
