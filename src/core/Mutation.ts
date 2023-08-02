import {EntryLocation} from './EntryLocation.js'
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

export interface MoveMutation {
  type: MutationType.Move
  entryId: string
  location: EntryLocation
}

export interface FileUploadMutation {
  type: MutationType.FileUpload
  entryId: string
}
