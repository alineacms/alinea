import {EntryRow} from './EntryRow.js'

export enum MutationProgress {
  Finished = 'finished',
  Pending = 'pending',
  Error = 'error'
}

export enum MutationType {
  Edit = 'update',
  Publish = 'publish',
  Archive = 'archive',
  Discard = 'discard',
  Remove = 'remove',
  Order = 'order',
  Move = 'move',
  FileUpload = 'file-upload',
  FileRemove = 'file-remove'
}

export type PendingMutation = Mutation & {
  mutationId: string
  createdAt: number
}

export type Mutation =
  | EditMutation
  | PublishMutation
  | ArchiveMutation
  | RemoveEntryMutation
  | DiscardDraftMutation
  | OrderMutation
  | MoveMutation
  | FileUploadMutation
  | FileRemoveMutation

export interface EditMutation {
  type: MutationType.Edit
  entryId: string
  file: string
  entry: EntryRow
}

export interface PublishMutation {
  type: MutationType.Publish
  entryId: string
  file: string
}

export interface ArchiveMutation {
  type: MutationType.Archive
  entryId: string
  file: string
}

export interface RemoveEntryMutation {
  type: MutationType.Remove
  entryId: string
  file: string
}

export interface DiscardDraftMutation {
  type: MutationType.Discard
  entryId: string
  file: string
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
  entryType: string
  fromFile: string
  toFile: string
  parent: string
  root: string
  workspace: string
  index: string
}

export interface FileUploadMutation {
  type: MutationType.FileUpload
  entryId: string
  file: string
  entry: EntryRow
}

export interface FileRemoveMutation {
  type: MutationType.FileRemove
  entryId: string
  file: string
  location: string
}
