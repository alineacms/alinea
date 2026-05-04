import type {FieldOptions, WithoutLabel} from '#/core.js'
import {RecordField} from '#/core/field/RecordField.js'
import {Type, type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {type ImageField, type ImageLink, image} from '#/field/link.js'
import {type ObjectField, object} from '#/field/object.js'
import {type TextField, text} from '#/field/text.js'

export interface MetadataOptions extends FieldOptions<Metadata> {
  inferTitleFrom?: string
  inferDescriptionFrom?: string
  inferImageFrom?: string
}

export interface MetadataFields {
  title: TextField
  description: TextField
  openGraph: ObjectField<{
    image: ImageField
    title: TextField
    description: TextField
  }>
}

export interface Metadata {
  title: string
  description: string
  openGraph: {
    image: ImageLink
    title: string
    description: string
  }
}

export class MetadataField extends RecordField<
  Metadata,
  MetadataOptions & {fields: Type<MetadataFields>}
> {}

export function metadata(
  label = 'Metadata',
  options: WithoutLabel<MetadataOptions> = {}
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
      })
    }
  })
  return new MetadataField(fields, {
    options: {
      label,
      initialValue: Type.initialValue(fields) as any,
      ...options,
      fields
    },
    view: viewKeys.MetadataInput
  })
}
