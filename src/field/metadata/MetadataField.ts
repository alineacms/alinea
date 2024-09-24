import type {FieldOptions, WithoutLabel} from 'alinea/core'
import {Type, type} from 'alinea/core/Type'
import {RecordField} from 'alinea/core/field/RecordField'
import {ImageField, image} from 'alinea/field/link'
import {ObjectField, object} from 'alinea/field/object'
import {TextField, text} from 'alinea/field/text'

export interface MetadataOptions
  extends FieldOptions<Type.Infer<MetadataFields>> {
  inferTitleFrom?: string
  inferDescriptionFrom?: string
  inferImageFrom?: string
}

export interface MetadataFields {
  title: TextField
  description: TextField
  openGraph: ObjectField<{
    siteName: TextField
    image: ImageField
    title: TextField
    description: TextField
  }>
}

export class MetadataField extends RecordField<
  Type.Infer<MetadataFields>,
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
      openGraph: object('Open graph', {
        fields: {
          siteName: text('Site name', {width: 0.25}),
          image: image('Image', {
            width: 0.75,
            help: 'Recommended size: 1200 x 630 pixels'
          }),
          title: text('Title'),
          description: text('Description', {multiline: true})
        }
      })
    }
  })
  return new MetadataField(Type.shape(fields), {
    hint: Type.hint(fields),
    options: {label, ...options, fields},
    view: 'alinea/field/metadata/MetadataField.view#MetadataInput'
  })
}
