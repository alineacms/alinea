import type {FieldBeforeSaveContext, FieldOptions} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {Type, type} from '#/core/Type.js'
import {entries, fromEntries, isRecord} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {ObjectField} from '#/field/object.js'
import {aliases, type AliasesField} from './MetadataAliases.js'

export interface MetadataTimestampOptions extends FieldOptions<number | null> {
  width?: number
}

export interface MetadataUserOptions extends FieldOptions<MetadataAuditUser> {
  width?: number
}

export interface MetadataAuditUser {
  name: string
  email: string
}

export interface MetadataDetailsFields {
  createdAt: MetadataTimestampField
  createdBy: MetadataUserField
  updatedAt: MetadataTimestampField
  updatedBy: MetadataUserField
  aliases: AliasesField
}

export class MetadataTimestampField extends ScalarField<
  number | null,
  MetadataTimestampOptions
> {}

export class MetadataUserField extends ScalarField<
  MetadataAuditUser,
  MetadataUserOptions
> {}

/** Who created and last updated an entry and when, and its URL aliases */
export function metadataDetailsType(): Type<MetadataDetailsFields> {
  return type('Details', {
    fields: {
      createdAt: timestamp('Created at'),
      createdBy: user('Created by'),
      updatedAt: timestamp('Updated at'),
      updatedBy: user('Updated by'),
      aliases: aliases()
    }
  })
}

const auditFields = new WeakSet<object>()

/** Marks a field that stamps who last updated the entry and when */
export function withAudit<F extends object>(field: F): F {
  auditFields.add(field)
  return field
}

/**
 * Whether entries of a type store who last updated them and when, in a
 * `metadata` field made with `metadata()` or `auditMetadata()`
 */
export function hasAuditMetadata(type: Type): boolean {
  const field = Type.field(type, 'metadata')
  return field !== undefined && auditFields.has(field)
}

/** Metadata that only holds the details, stamped on every save */
export function auditMetadata(
  label = 'Metadata'
): ObjectField<MetadataDetailsFields> & MetadataDetailsFields {
  const fields = metadataDetailsType()
  const field = new ObjectField<MetadataDetailsFields>(fields, {
    options: {label, fields},
    view: viewKeys.ObjectInput,
    beforeSave(context) {
      const details = beforeSaveWithAudit(fields, context)
      return fromEntries(
        entries(details).filter(([key, value]) => !isPlaceholder(key, value))
      ) as Type.Infer<typeof fields>
    }
  })
  return withAudit(Object.assign(field, fields))
}

/** Unknown creation details and empty aliases, which files leave out */
function isPlaceholder(key: string, value: unknown) {
  switch (key) {
    case 'createdAt':
      return value === null
    case 'createdBy':
      return isRecord(value) && !value.name && !value.email
    case 'aliases':
      return Array.isArray(value) && value.length === 0
    default:
      return false
  }
}

/** Stamps the created and updated details, then saves the other fields */
export function beforeSaveWithAudit(
  fields: Type,
  {action, now, user, value}: FieldBeforeSaveContext<unknown>
): Record<string, unknown> {
  const source: Record<string, unknown> = isRecord(value) ? value : {}
  const timestamp = Math.floor(now.getTime() / 1000)
  const actor = {name: user?.name ?? '', email: user?.email ?? ''}
  const isCreate = action === 'create' || action === 'translate'
  let next = source

  function set(key: string, nextValue: unknown) {
    // An entry created without a known user (eg. imported through the API)
    // keeps the details the caller provided, only missing ones are filled in
    if (!user && isCreate && hasValue(source[key])) return
    if (next[key] === nextValue) return
    if (next === source) next = {...source}
    next[key] = nextValue
  }

  // Only a create records who created the entry, others leave it unknown
  if (isCreate) {
    set('createdAt', timestamp)
    set('createdBy', actor)
  } else {
    const createdAt = timestampFromValue(source.createdAt)
    if (createdAt !== undefined) set('createdAt', createdAt)
  }
  set('updatedAt', timestamp)
  set('updatedBy', actor)

  return Type.beforeSave(fields, next, {action, now, user})
}

function hasValue(value: unknown): boolean {
  if (isRecord(value)) return Boolean(value.name || value.email)
  return value !== undefined && value !== null
}

function timestamp(label: string): MetadataTimestampField {
  return new MetadataTimestampField({
    options: {
      label,
      initialValue: null,
      readOnly: true,
      width: 0.5
    },
    view: viewKeys.MetadataTimestampInput
  })
}

function user(label: string): MetadataUserField {
  return new MetadataUserField({
    options: {
      label,
      initialValue: {name: '', email: ''},
      readOnly: true,
      width: 0.5
    },
    view: viewKeys.MetadataUserInput
  })
}

function timestampFromValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value.length === 0) return undefined
  const parsed = new Date(value).getTime()
  if (Number.isNaN(parsed)) return undefined
  return Math.floor(parsed / 1000)
}
