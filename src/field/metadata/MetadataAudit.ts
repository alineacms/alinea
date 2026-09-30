import type {FieldBeforeSaveContext, FieldOptions} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {Type, type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
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

/** Metadata that only holds the details, stamped on every save */
export function auditMetadata(
  label = 'Metadata'
): ObjectField<MetadataDetailsFields> & MetadataDetailsFields {
  const fields = metadataDetailsType()
  const field = new ObjectField<MetadataDetailsFields>(fields, {
    options: {label, fields},
    view: viewKeys.ObjectInput,
    beforeSave(context) {
      return beforeSaveWithAudit(fields, context) as Type.Infer<typeof fields>
    }
  })
  return Object.assign(field, fields)
}

/** Stamps the created and updated details, then saves the other fields */
export function beforeSaveWithAudit(
  fields: Type,
  {action, now, user, value}: FieldBeforeSaveContext<unknown>
): Record<string, unknown> {
  const source: Record<string, unknown> = isRecord(value) ? value : {}
  const timestamp = Math.floor(now.getTime() / 1000)
  const actor = {name: user?.name ?? '', email: user?.email ?? ''}
  let next = source

  function set(key: string, nextValue: unknown) {
    if (next[key] === nextValue) return
    if (next === source) next = {...source}
    next[key] = nextValue
  }

  const createdAt = timestampFromValue(source.createdAt)
  const refreshCreatedFields =
    action === 'create' || action === 'translate' || createdAt === undefined
  if (refreshCreatedFields) {
    set('createdAt', timestamp)
    set('createdBy', actor)
  } else {
    set('createdAt', createdAt)
  }
  if (!refreshCreatedFields && !isMetadataAuditUser(source.createdBy)) {
    set('createdBy', actor)
  }
  set('updatedAt', timestamp)
  set('updatedBy', actor)

  return Type.beforeSave(fields, next, {action, now, user})
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

function isMetadataAuditUser(value: unknown): value is MetadataAuditUser {
  if (!isRecord(value)) return false
  return typeof value.name === 'string' && typeof value.email === 'string'
}
