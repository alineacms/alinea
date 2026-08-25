import type {EntryStatus} from '#/core/Entry.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {isRecord} from '#/core/util/Objects.js'

export type ReplicaCommand =
  | CreateEntryCommand
  | UpdateEntryCommand
  | RemoveEntryCommand
  | MoveEntryCommand
  | PublishEntryCommand
  | UnpublishEntryCommand
  | ArchiveEntryCommand
  | UploadFileCommand
  | RemoveFileCommand

export interface CreateEntryCommand {
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

/** Compatibility for an update mixed with structural commands. */
export interface UpdateEntryCommand {
  kind: 'updateEntry'
  id: string
  locale: string | null
  status: EntryStatus
  set: Record<string, unknown>
}

export interface RemoveEntryCommand {
  kind: 'removeEntry'
  id: string
  locale?: string | null
  status?: 'draft' | 'archived' | 'published'
}

export interface MoveEntryCommand {
  kind: 'moveEntry'
  id: string
  target: string
  dropPosition: 'after' | 'before' | 'on'
  targetType?: 'entry' | 'root'
}

export interface PublishEntryCommand {
  kind: 'publishEntry'
  id: string
  locale: string | null
  status: 'draft' | 'archived'
}

export interface UnpublishEntryCommand {
  kind: 'unpublishEntry'
  id: string
  locale: string | null
}

export interface ArchiveEntryCommand {
  kind: 'archiveEntry'
  id: string
  locale: string | null
}

export interface UploadFileCommand {
  kind: 'uploadFile'
  url: string
  location: string
}

export interface RemoveFileCommand {
  kind: 'removeFile'
  location: string
}

export interface ReplicaCommandResult {
  revision: string
}

export function replicaCommandsFromMutations(
  mutations: ReadonlyArray<Mutation>
): Array<ReplicaCommand> {
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

export function mutationsFromReplicaCommands(
  commands: ReadonlyArray<ReplicaCommand>
): Array<Mutation> {
  return commands.map(command => {
    switch (command.kind) {
      case 'createEntry': {
        const {kind: _, ...input} = command
        return {op: 'create', ...input}
      }
      case 'updateEntry': {
        const {kind: _, ...input} = command
        return {op: 'update', ...input}
      }
      case 'removeEntry': {
        const {kind: _, ...input} = command
        return {op: 'remove', ...input}
      }
      case 'moveEntry': {
        const {kind: _, ...input} = command
        return {op: 'move', ...input}
      }
      case 'publishEntry': {
        const {kind: _, ...input} = command
        return {op: 'publish', ...input}
      }
      case 'unpublishEntry': {
        const {kind: _, ...input} = command
        return {op: 'unpublish', ...input}
      }
      case 'archiveEntry': {
        const {kind: _, ...input} = command
        return {op: 'archive', ...input}
      }
      case 'uploadFile': {
        const {kind: _, ...input} = command
        return {op: 'uploadFile', ...input}
      }
      case 'removeFile': {
        const {kind: _, ...input} = command
        return {op: 'removeFile', ...input}
      }
    }
  })
}

export function parseReplicaCommands(input: unknown): Array<ReplicaCommand> {
  if (!Array.isArray(input) || !input.every(isReplicaCommand))
    throw new Error('Expected replica commands')
  return input
}

function isReplicaCommand(input: unknown): input is ReplicaCommand {
  if (!isRecord(input) || typeof input.kind !== 'string') return false
  switch (input.kind) {
    case 'createEntry':
      return (
        typeof input.type === 'string' &&
        (input.locale === null || typeof input.locale === 'string') &&
        isRecord(input.data)
      )
    case 'updateEntry':
      return (
        typeof input.id === 'string' &&
        (input.locale === null || typeof input.locale === 'string') &&
        isEntryStatus(input.status) &&
        isRecord(input.set)
      )
    case 'removeEntry':
    case 'archiveEntry':
    case 'unpublishEntry':
      return typeof input.id === 'string'
    case 'moveEntry':
      return (
        typeof input.id === 'string' &&
        typeof input.target === 'string' &&
        (input.dropPosition === 'after' ||
          input.dropPosition === 'before' ||
          input.dropPosition === 'on')
      )
    case 'publishEntry':
      return (
        typeof input.id === 'string' &&
        (input.status === 'draft' || input.status === 'archived')
      )
    case 'uploadFile':
      return typeof input.url === 'string' && typeof input.location === 'string'
    case 'removeFile':
      return typeof input.location === 'string'
    default:
      return false
  }
}

function isEntryStatus(input: unknown): input is EntryStatus {
  return input === 'draft' || input === 'published' || input === 'archived'
}
