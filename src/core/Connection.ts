import {Changes} from 'alinea/backend/data/Changes'
import {AlineaMeta} from 'alinea/backend/db/AlineaMeta'
import {Future, Media, User} from 'alinea/core'
import {Entry} from './Entry.js'
import {Selection} from './pages/Selection.js'
import {Logger} from './util/Logger.js'

export interface UpdateResponse {
  contentHash: string
  entries: Array<Entry>
}

export interface Syncable {
  updates(request: AlineaMeta): Promise<UpdateResponse | Uint8Array>
  ids(): Promise<Array<string>>
}

export interface Connection extends Syncable {
  resolve(selection: Selection): Promise<unknown>
  uploadFile(params: Connection.UploadParams): Future<Media.File>
  publishEntries(params: Connection.PublishParams): Future
}

export namespace Connection {
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
  export type PublishParams = {
    entries: Array<Entry>
  }
  export type MediaUploadParams = {
    buffer: ArrayBuffer
    fileLocation: string
  }
  export type Download =
    | {type: 'buffer'; buffer: ArrayBuffer}
    | {type: 'url'; url: string}
  export type DownloadParams = {
    location: string
  }
  export type ChangesParams = {
    changes: Changes
  }
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
  const base = '/hub'
  export const routes = {
    base,
    resolve() {
      return base + `/resolve`
    },
    updates() {
      return base + `/updates`
    },
    ids() {
      return base + `/ids`
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
