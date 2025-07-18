import type {EntryStatus} from '../Entry.js'

export type Mutation =
  | CreateMutation
  | UpdateMutation
  | RemoveMutation
  | MoveMutation
  | PublishMutation
  | UnpublishMutation
  | ArchiveMutation
  | UploadFileMutation
  | RemoveFileMutation

export interface CreateMutation {
  op: 'create'
  type: string
  locale: string | null
  root: string
  workspace: string
  data: Record<string, unknown>
  parentId?: string | null
  id?: string
  insertOrder?: 'first' | 'last'
  status?: 'draft' | 'archived' | 'published'
  overwrite?: boolean
  fromSeed?: string
}

export interface UpdateMutation {
  op: 'update'
  id: string
  locale: string | null
  status: EntryStatus
  set: Record<string, unknown>
}

export interface RemoveMutation {
  op: 'remove'
  id: string
  locale?: string | null
  status?: 'draft' | 'archived' | 'published'
}

export interface PublishMutation {
  op: 'publish'
  id: string
  locale: string | null
  status: 'draft' | 'archived'
}

export interface UnpublishMutation {
  op: 'unpublish'
  id: string
  locale: string | null
}

export interface ArchiveMutation {
  op: 'archive'
  id: string
  locale: string | null
}

export interface MoveMutation {
  op: 'move'
  id: string
  after: string | null
  toParent?: string
  toRoot?: string
}

export interface UploadFileMutation {
  op: 'uploadFile'
  url: string
  location: string
}

export interface RemoveFileMutation {
  op: 'removeFile'
  location: string
}
