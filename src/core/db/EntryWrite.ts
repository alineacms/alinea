import type {EntryStatus} from '../Entry.js'
import type {Mutation} from './Mutation.js'

export type EntryWrite =
  | CreateEntryWrite
  | UpdateEntryWrite
  | RemoveEntryWrite
  | MoveEntryWrite
  | PublishEntryWrite
  | UnpublishEntryWrite
  | ArchiveEntryWrite
  | UploadFileWrite
  | RemoveFileWrite

export interface CreateEntryWrite {
  kind: 'createEntry'
  type: string
  locale: string | null
  data: Record<string, unknown>
  parentId?: string | null
  id?: string
  insertOrder?: 'first' | 'last'
  status?: 'draft' | 'archived' | 'published'
  overwrite?: boolean
  fromSeed?: string
  root?: string
  workspace?: string
}

export interface UpdateEntryWrite {
  kind: 'updateEntry'
  id: string
  locale: string | null
  status: EntryStatus
  set: Record<string, unknown>
}

export interface RemoveEntryWrite {
  kind: 'removeEntry'
  id: string
  locale?: string | null
  status?: 'draft' | 'archived' | 'published'
}

export interface MoveEntryWrite {
  kind: 'moveEntry'
  id: string
  target: string
  dropPosition: 'after' | 'before' | 'on'
  targetType?: 'entry' | 'root'
}

export interface PublishEntryWrite {
  kind: 'publishEntry'
  id: string
  locale: string | null
  status: 'draft' | 'archived'
}

export interface UnpublishEntryWrite {
  kind: 'unpublishEntry'
  id: string
  locale: string | null
}

export interface ArchiveEntryWrite {
  kind: 'archiveEntry'
  id: string
  locale: string | null
}

export interface UploadFileWrite {
  kind: 'uploadFile'
  url: string
  location: string
}

export interface RemoveFileWrite {
  kind: 'removeFile'
  location: string
}

export function entryWritesFromMutations(
  mutations: ReadonlyArray<Mutation>
): Array<EntryWrite> {
  return mutations.map(mutation => {
    switch (mutation.op) {
      case 'create': {
        const {op: _, ...input} = mutation
        return {kind: 'createEntry', ...input}
      }
      case 'update': {
        const {op: _, ...input} = mutation
        return {kind: 'updateEntry', ...input}
      }
      case 'remove': {
        const {op: _, ...input} = mutation
        return {kind: 'removeEntry', ...input}
      }
      case 'move': {
        const {op: _, ...input} = mutation
        return {kind: 'moveEntry', ...input}
      }
      case 'publish': {
        const {op: _, ...input} = mutation
        return {kind: 'publishEntry', ...input}
      }
      case 'unpublish': {
        const {op: _, ...input} = mutation
        return {kind: 'unpublishEntry', ...input}
      }
      case 'archive': {
        const {op: _, ...input} = mutation
        return {kind: 'archiveEntry', ...input}
      }
      case 'uploadFile': {
        const {op: _, ...input} = mutation
        return {kind: 'uploadFile', ...input}
      }
      case 'removeFile': {
        const {op: _, ...input} = mutation
        return {kind: 'removeFile', ...input}
      }
    }
  })
}

export function mutationsFromEntryWrites(
  writes: ReadonlyArray<EntryWrite>
): Array<Mutation> {
  return writes.map(write => {
    switch (write.kind) {
      case 'createEntry': {
        const {kind: _, ...input} = write
        return {op: 'create', ...input}
      }
      case 'updateEntry': {
        const {kind: _, ...input} = write
        return {op: 'update', ...input}
      }
      case 'removeEntry': {
        const {kind: _, ...input} = write
        return {op: 'remove', ...input}
      }
      case 'moveEntry': {
        const {kind: _, ...input} = write
        return {op: 'move', ...input}
      }
      case 'publishEntry': {
        const {kind: _, ...input} = write
        return {op: 'publish', ...input}
      }
      case 'unpublishEntry': {
        const {kind: _, ...input} = write
        return {op: 'unpublish', ...input}
      }
      case 'archiveEntry': {
        const {kind: _, ...input} = write
        return {op: 'archive', ...input}
      }
      case 'uploadFile': {
        const {kind: _, ...input} = write
        return {op: 'uploadFile', ...input}
      }
      case 'removeFile': {
        const {kind: _, ...input} = write
        return {op: 'removeFile', ...input}
      }
    }
  })
}
