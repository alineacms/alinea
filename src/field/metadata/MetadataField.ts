import type {FieldBeforeSaveContext, FieldOptions} from '#/core/Field.js'
import {RecordField} from '#/core/field/RecordField.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {Type, type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {type ImageField, type ImageLink, image} from '#/field/link.js'
import {type ObjectField, object} from '#/field/object.js'
import {type TextField, text} from '#/field/text.js'

export interface MetadataTimestampOptions extends FieldOptions<number | null> {
  width?: number
}

export interface MetadataUserOptions extends FieldOptions<MetadataAuditUser> {
  width?: number
}

export interface MetadataFields {
  title: TextField
  description: TextField
  openGraph: ObjectField<{
    image: ImageField
    title: TextField
    description: TextField
  }>
  createdAt: MetadataTimestampField
  createdBy: MetadataUserField
  updatedAt: MetadataTimestampField
  updatedBy: MetadataUserField
}

export interface MetadataAuditUser {
  name: string
  email: string
}

export interface Metadata {
  title: string
  description: string
  openGraph: {
    image: ImageLink
    title: string
    description: string
  }
  createdAt: number | null
  createdBy: MetadataAuditUser
  updatedAt: number | null
  updatedBy: MetadataAuditUser
}

export class MetadataField extends RecordField<
  Metadata,
  {label: string; fields: Type<MetadataFields>}
> {}

export class MetadataTimestampField extends ScalarField<
  number | null,
  MetadataTimestampOptions
> {}

export class MetadataUserField extends ScalarField<
  MetadataAuditUser,
  MetadataUserOptions
> {}

export function metadata(
  label = 'Metadata',
  options: Partial<MetadataFields> = {}
) {
  const fields = type('Fields', {
    fields: {
      title: text('Title'),
      description: text('Description', {
        multiline: true,
        help: 'Optimal length: 120–160 characters',
        validate(value) {
          if (value.length > 160) return 'Too many characters.'
        }
      }),
      openGraph: object('Open Graph', {
        fields: {
          image: image('Image', {
            help: 'Recommended size: 1200x630 pixels'
          }),
          title: text('Title', {help: 'If empty, default title'}),
          description: text('Description', {
            multiline: true,
            help: 'If empty, default description'
          })
        }
      }),
      createdAt: timestamp('Created at'),
      createdBy: user('Created by'),
      updatedAt: timestamp('Updated at'),
      updatedBy: user('Updated by')
    }
  })
  return new MetadataField(fields, {
    options: {
      label,
      ...options,
      fields
    },
    defaultValue() {
      return Type.initialValue(fields) as unknown as Metadata
    },
    view: viewKeys.MetadataInput,
    beforeSave(context) {
      const typeContext = {
        action: context.action,
        now: context.now,
        user: context.user
      }
      return Type.beforeSave(
        fields,
        metadataWithAudit(context) as unknown as Record<string, unknown>,
        typeContext
      ) as unknown as Metadata
    }
  })
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

function metadataWithAudit({
  action,
  now,
  user,
  value
}: FieldBeforeSaveContext<Metadata>) {
  const source: Record<string, unknown> = isRecord(value) ? value : {}
  const timestamp = Math.floor(now.getTime() / 1000)
  const actor = metadataAuditUser(user)
  let next: Record<string, unknown> = isRecord(value) ? source : {}

  function set(key: keyof Metadata, nextValue: unknown) {
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

  return next as unknown as Metadata
}

function metadataAuditUser(
  user: FieldBeforeSaveContext<Metadata>['user']
): MetadataAuditUser {
  return {
    name: user?.name ?? '',
    email: user?.email ?? ''
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
