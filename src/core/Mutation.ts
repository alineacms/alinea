import {EntryRow, EntryStatus} from './EntryRow.js'

export enum MutationProgress {
  Finished = 'finished',
  Pending = 'pending',
  Error = 'error'
}

export enum MutationType {
  Edit = 'update',
  Patch = 'patch',
  Create = 'create',
  Publish = 'publish',
  Archive = 'archive',
  Discard = 'discard',
  Remove = 'remove',
  Order = 'order',
  Move = 'move',
  Upload = 'upload',
  FileRemove = 'file-remove'
}

export type PendingMutation = Mutation & {
  mutationId: string
  createdAt: number
}

export type Mutation =
  | EditMutation
  | PatchMutation
  | CreateMutation
  | PublishMutation
  | ArchiveMutation
  | RemoveEntryMutation
  | DiscardDraftMutation
  | OrderMutation
  | MoveMutation
  | UploadMutation
  | FileRemoveMutation

export interface EditMutation {
  type: MutationType.Edit
  entryId: string
  locale: string | null
  file: string
  entry: EntryRow
  previousFile?: string
  update?: string
}

export interface CreateMutation {
  type: MutationType.Create
  entryId: string
  locale: string | null
  file: string
  entry: EntryRow
}

export interface PublishMutation {
  type: MutationType.Publish
  entryId: string
  locale: string | null
  status: EntryStatus
  file: string
}

export interface ArchiveMutation {
  type: MutationType.Archive
  entryId: string
  locale: string | null
  file: string
}

export interface RemoveEntryMutation {
  type: MutationType.Remove
  entryId: string
  locale: string | null
  file: string
}

export interface DiscardDraftMutation {
  type: MutationType.Discard
  entryId: string
  locale: string | null
  file: string
}

export interface PatchMutation {
  type: MutationType.Patch
  entryId: string
  locale: string | null
  file: string
  patch: object
}

export interface OrderMutation {
  type: MutationType.Order
  entryId: string
  file: string
  index: string
}

export interface MoveMutation {
  type: MutationType.Move
  entryId: string
  locale: string | null
  entryType: string
  fromFile: string
  toFile: string
  parent: string
  root: string
  workspace: string
  index: string
}

export interface UploadMutation {
  type: MutationType.Upload
  entryId: string
  url: string
  file: string
}

export interface FileRemoveMutation {
  type: MutationType.FileRemove
  entryId: string
  locale: string | null
  file: string
  workspace: string
  location: string
  replace: boolean
}
