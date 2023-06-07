import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {AlineaMeta} from 'alinea/backend/db/AlineaMeta'
import {Media, User} from 'alinea/core'
import {PreviewUpdate} from 'alinea/preview/PreviewMessage'
import {Entry} from './Entry.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/Selection.js'
import {Logger} from './util/Logger.js'

export interface UpdateResponse {
  contentHash: string
  entries: Array<Entry>
}

export interface Syncable {
  updates(request: AlineaMeta): Promise<UpdateResponse>
  versionIds(): Promise<Array<string>>
}

export interface Connection extends Syncable {
  previewToken(): Promise<string>
  resolve(params: Connection.ResolveParams): Promise<unknown>
  uploadFile(params: Connection.UploadParams): Promise<Media.File>
  saveDraft(entry: Entry): Promise<void>
  publishDrafts(entries: Array<Entry>): Promise<void>
  // archive
  // createEntries(params: Connection.CreateParams): Promise<void>
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
  export interface ResolveParams {
    selection: Selection
    location?: Array<string>
    realm?: Realm
    preview?: PreviewUpdate
  }
  export type CreateParams = {
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
    changes: ChangeSet
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
    versionIds() {
      return base + `/versionIds`
    },
    saveDraft() {
      return base + `/save`
    },
    publishDrafts() {
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
    },
    previewToken() {
      return base + `/preview-token`
    }
  }
}
