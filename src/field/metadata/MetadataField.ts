import type {FieldOptions, WithoutLabel} from 'alinea/core'
import {RecordField} from 'alinea/core/field/RecordField'
import {type Type, type} from 'alinea/core/Type'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import {type ImageField, type ImageLink, image} from 'alinea/field/link'
import {type ObjectField, object} from 'alinea/field/object'
import {type TextField, text} from 'alinea/field/text'

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
      title: text('Title', {width: 0.5}),
      description: text('Description', {multiline: true}),
      openGraph: object('Open Graph', {
        fields: {
          image: image('Image', {
            help: 'Recommended size: 1200x630 pixels'
          }),
          title: text('Title'),
          description: text('Description', {multiline: true})
        }
      })
    }
  })
  return new MetadataField(fields, {
    options: {label, ...options, fields},
    view: viewKeys.MetadataInput
  })
}
