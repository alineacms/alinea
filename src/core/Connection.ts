import {Drafts} from 'alinea/backend/Drafts'
import {History, Revision} from 'alinea/backend/History'
import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {Draft} from './Draft.js'
import {EntryRecord} from './EntryRecord.js'
import {EntryRow} from './EntryRow.js'
import {Mutation} from './Mutation.js'
import {ResolveDefaults, Resolver} from './Resolver.js'
import {User} from './User.js'
import {Selection} from './pages/Selection.js'
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
  previewToken(): Promise<string>
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
    revisions() {
      return base + `/revisions`
    },
    sync() {
      return base + `/sync`
    },
    draft() {
      return base + `/draft`
    },
    media() {
      return base + `/media`
    },
    prepareUpload() {
      return base + `/upload`
    },
    files(location?: string) {
      return base + `/files${location ? '/' + location : ''}`
    },
    previewToken() {
      return base + `/preview-token`
    }
  }
}
