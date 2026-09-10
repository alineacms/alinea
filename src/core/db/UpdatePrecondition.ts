import type {Entry, EntryStatus} from '../Entry.js'
import {HttpError} from '../HttpError.js'
import {sha256Hash} from '../source/Utils.js'
import {canonicalJson, hashFieldValue} from '../util/Json.js'
import {isRecord} from '../util/Objects.js'
import type {Mutation} from './Mutation.js'

export interface UpdatePrecondition {
  structure: string
  fields: Record<string, string | null>
}

const structureFields = [
  'id',
  'locale',
  'type',
  'workspace',
  'root',
  'versionStatus',
  'status',
  'parentId',
  'parents',
  'path',
  'url',
  'index',
  'active',
  'main',
  'seeded'
] as const

export interface UpdateStructure extends Pick<
  Entry,
  Exclude<(typeof structureFields)[number], 'versionStatus'>
> {
  versionStatus: EntryStatus
}

/** Routing/lifecycle changes cannot masquerade as an independent field edit. */
export function hashUpdateStructure(entry: UpdateStructure): Promise<string> {
  return sha256Hash(
    new TextEncoder().encode(
      `alinea.update.structure.v1\0${canonicalJson(
        structureFields.map(field => entry[field] ?? null)
      )}`
    )
  )
}

export async function updatePrecondition(
  entry: UpdateStructure,
  data: Record<string, unknown>,
  set: Record<string, unknown>
): Promise<UpdatePrecondition> {
  const structure = hashUpdateStructure(entry)
  const fields = await Promise.all(
    Object.keys(set).map(
      async key =>
        [
          key,
          await hashFieldValue(Object.hasOwn(data, key) ? data[key] : undefined)
        ] as const
    )
  )
  return {structure: await structure, fields: Object.fromEntries(fields)}
}

function hash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

export function readUpdatePrecondition(
  set: Record<string, unknown>,
  value: unknown
): UpdatePrecondition | undefined {
  if (value === undefined) return
  if (
    !isRecord(set) ||
    !isRecord(value) ||
    !hash(value.structure) ||
    !isRecord(value.fields)
  )
    throw new HttpError(400, 'Invalid update precondition')
  const names = Object.keys(set)
  const fields = value.fields
  if (
    !names.length ||
    names.length > 256 ||
    Object.keys(fields).length !== names.length ||
    !names.every(
      key =>
        Object.hasOwn(fields, key) &&
        (fields[key] === null || hash(fields[key]))
    )
  )
    throw new HttpError(
      400,
      'Update preconditions must cover exactly the changed fields'
    )
  return {
    structure: value.structure,
    fields: Object.fromEntries(
      names.map(key => [key, fields[key] as string | null])
    )
  }
}

/** Structural and mixed batches retain whole-revision CAS. */
export function canRebaseUpdates(mutations: ReadonlyArray<Mutation>): boolean {
  return (
    mutations.length > 0 &&
    mutations.every(mutation => {
      if (
        mutation.op !== 'update' ||
        !readUpdatePrecondition(mutation.set, mutation.precondition)
      )
        return false
      return Object.keys(mutation.set).every(
        key =>
          !key.startsWith('_') &&
          !['path', 'metadata', 'aliases', 'constructor', 'prototype'].includes(
            key
          )
      )
    })
  )
}

export async function assertUpdatePrecondition(
  precondition: UpdatePrecondition,
  entry: UpdateStructure,
  data: Record<string, unknown>
): Promise<void> {
  if ((await hashUpdateStructure(entry)) !== precondition.structure)
    throw new HttpError(409, 'Entry structure changed while editing')
  for (const [field, expected] of Object.entries(precondition.fields)) {
    if (
      (await hashFieldValue(
        Object.hasOwn(data, field) ? data[field] : undefined
      )) !== expected
    )
      throw new HttpError(409, `Field changed while editing: ${field}`)
  }
}
