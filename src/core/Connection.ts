import {Drafts} from 'alinea/backend/Drafts'
import {History, Revision} from 'alinea/backend/History'
import {PreviewInfo} from 'alinea/backend/Previews'
import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {Draft} from './Draft.js'
import {EntryRecord} from './EntryRecord.js'
import {EntryRow} from './EntryRow.js'
import {Mutation} from './Mutation.js'
import {Resolver, ResolveRequest} from './Resolver.js'
import {User} from './User.js'
import {Logger} from './util/Logger.js'

export interface SyncResponse {
  insert: Array<EntryRow>
  remove: Array<string>
}

export interface Syncable {
  syncRequired(contentHash: string): Promise<boolean>
  sync(contentHashes: Array<string>): Promise<SyncResponse>
}

export interface Connection extends Resolver, Syncable, History, Drafts {
  resolve(params: ResolveRequest): Promise<unknown>
  previewToken(request: PreviewInfo): Promise<string>
  mutate(mutations: Array<Mutation>): Promise<{commitHash: string}>
  prepareUpload(file: string): Promise<Connection.UploadResponse>
  revisions(file: string): Promise<Array<Revision>>
  revisionData(file: string, revisionId: string): Promise<EntryRecord>
  getDraft(entryId: string): Promise<Draft | undefined>
  storeDraft(draft: Draft): Promise<void>
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
  export interface UploadResponse {
    entryId: string
    location: string
    previewUrl: string
    upload: {
      url: string
      method?: string
    }
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
  export interface RevisionsParams {
    file: string
  }
  export interface MutateParams {
    commitHash: string
    mutations: ChangeSet
  }
  export interface AuthContext {
    user?: User
    token?: string
  }
  export interface Context extends AuthContext {
    logger: Logger
  }
  export const routes = {
    resolve() {
      return `/resolve`
    },
    mutate() {
      return `/mutate`
    },
    revisions() {
      return `/revisions`
    },
    sync() {
      return `/sync`
    },
    draft() {
      return `/draft`
    },
    media() {
      return `/media`
    },
    prepareUpload() {
      return `/upload`
    },
    files(location?: string) {
      return `/files&location=${location}`
    },
    previewToken() {
      return `/preview-token`
    },
    preview() {
      return `/preview`
    }
  }
}
