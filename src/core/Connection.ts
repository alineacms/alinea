import {Changes} from 'alinea/backend/Storage'
import {base64url} from 'alinea/core/util/Encoding'
import {CursorImpl} from 'alinea/store'
import {Entry} from './Entry.js'
import {Future} from './Future.js'
import {Media} from './Media.js'
import {User} from './User.js'
import {Logger} from './util/Logger.js'

export interface Connection<T = any> {
  entry(
    params: Connection.EntryParams,
    ctx?: Connection.Context
  ): Future<Entry.Detail | null>
  query<T>(
    params: Connection.QueryParams<T>,
    ctx?: Connection.Context
  ): Future<Array<T>>
  updateDraft(params: Connection.UpdateParams, ctx?: Connection.Context): Future
  deleteDraft(
    params: Connection.DeleteParams,
    ctx?: Connection.Context
  ): Future<boolean>
  listDrafts(
    params: Connection.ListParams,
    ctx?: Connection.Context
  ): Future<Array<{id: string}>>
  uploadFile(
    params: Connection.UploadParams,
    ctx?: Connection.Context
  ): Future<Media.File>
  publishEntries(
    params: Connection.PublishParams,
    ctx?: Connection.Context
  ): Future
}

export namespace Connection {
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
    cursor: CursorImpl<T>
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
