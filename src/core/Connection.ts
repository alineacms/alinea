import {Media} from 'alinea/backend'
import {History, Revision} from 'alinea/backend/History'
import {ResolveDefaults} from 'alinea/backend/Resolver'
import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {AlineaMeta} from 'alinea/backend/db/AlineaMeta'
import {EntryRecord} from './EntryRecord.js'
import {EntryRow} from './EntryRow.js'
import {Mutation} from './Mutation.js'
import {User} from './User.js'
import {Selection} from './pages/Selection.js'
import {Logger} from './util/Logger.js'

export interface UpdateResponse {
  contentHash: string
  entries: Array<EntryRow>
}

export interface Syncable {
  updates(request: AlineaMeta): Promise<UpdateResponse>
  versionIds(): Promise<Array<string>>
}

export interface Connection extends Syncable, History {
  previewToken(): Promise<string>
  resolve(params: Connection.ResolveParams): Promise<unknown>
  mutate(mutations: Array<Mutation>): Promise<void>
  uploadFile(params: Connection.UploadParams): Promise<Media.File>
  revisions(filePath: string): Promise<Array<Revision>>
  revisionData(revisionId: string): Promise<EntryRecord>
}

export namespace Connection {
  export type UploadParams = {
    parentId?: string
    workspace: string
    root: string
    path: string
    buffer: ArrayBuffer
    preview?: string
    averageColor?: string
    thumbHash?: string
    width?: number
    height?: number
  }
  export interface ResolveParams extends ResolveDefaults {
    selection: Selection
    location?: Array<string>
    locale?: string
  }
  export type MediaUploadParams = {
    buffer: ArrayBuffer
    fileLocation: string
  }
  export type Download =
    | {type: 'buffer'; buffer: ArrayBuffer}
    | {type: 'url'; url: string}
  export type DownloadParams = {
    workspace: string
    location: string
  }
  export type DeleteParams = {
    workspace: string
    location: string
  }
  export type MutateParams = {
    mutations: ChangeSet
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
    mutate() {
      return base + `/mutate`
    },
    revisions(filePath: string) {
      return base + `/revisions/${filePath}`
    },
    revisionData(revisionId: string) {
      return base + `/revisionData/${revisionId}`
    },
    updates() {
      return base + `/updates`
    },
    versionIds() {
      return base + `/versionIds`
    },
    media() {
      return base + `/media`
    },
    files(location?: string) {
      return base + `/files${location ? '/' + location : ''}`
    },
    previewToken() {
      return base + `/preview-token`
    }
  }
}
