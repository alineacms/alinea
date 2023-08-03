import {EntryRow} from './EntryRow.js'

export enum MutationProgress {
  Finished = 'finished',
  Pending = 'pending',
  Error = 'error'
}

export enum MutationType {
  Update = 'update',
  Publish = 'publish',
  Archive = 'archive',
  Remove = 'remove',
  Order = 'order',
  Move = 'move',
  FileUpload = 'file-upload'
}

export type PendingMutation = Mutation & {
  mutationId: string
  createdAt: number
}

export type Mutation =
  | EditMutation
  | PublishMutation
  | ArchiveMutation
  | RemoveMutation
  | OrderMutation
  | MoveMutation
  | FileUploadMutation

export interface EditMutation {
  type: MutationType.Update
  entryId: string
  entry: EntryRow
}

export interface PublishMutation {
  type: MutationType.Publish
  entryId: string
}

export interface ArchiveMutation {
  type: MutationType.Archive
  entryId: string
}

export interface RemoveMutation {
  type: MutationType.Remove
  entryId: string
}

export interface OrderMutation {
  type: MutationType.Order
  entryId: string
  index: string
}

export interface MoveMutation {
  type: MutationType.Move
  entryId: string
  index: string
  parent: string | null
  workspace: string
  root: string
}

export interface FileUploadMutation {
  type: MutationType.FileUpload
  entryId: string
  entry: EntryRow
}
