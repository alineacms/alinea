import {
  entryWritesFromMutations,
  mutationsFromEntryWrites,
  type EntryWrite
} from '#/core/db/EntryWrite.js'
import type {EntryStatus} from '#/core/Entry.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {isRecord} from '#/core/util/Objects.js'

export type ReplicaCommand = EntryWrite

export interface ReplicaCommandResult {
  revision: string
}

export function replicaCommandsFromMutations(
  mutations: ReadonlyArray<Mutation>
): Array<ReplicaCommand> {
  return entryWritesFromMutations(mutations)
}

export function mutationsFromReplicaCommands(
  commands: ReadonlyArray<ReplicaCommand>
): Array<Mutation> {
  return mutationsFromEntryWrites(commands)
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
