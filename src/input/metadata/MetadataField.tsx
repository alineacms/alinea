import {Field, Type, type} from 'alinea/core'
import {link} from 'alinea/input/link'
import {ObjectField, object} from 'alinea/input/object'
import {TextField, text} from 'alinea/input/text'
import {ImageReference} from '../../picker/entry/EntryReference.js'
import {LinkField} from '../link/LinkField.js'

export interface MetadataOptions {
  inferTitleFrom?: string
  inferDescriptionFrom?: string
  inferImageFrom?: string
}

export interface MetadataFields {
  title: TextField
  description: TextField
  openGraph: ObjectField<{
    title: TextField
    image: LinkField<ImageReference>
    description: TextField
  }>
}

export class MetadataField extends Field.Record<
  Type.Infer<MetadataFields>,
  MetadataOptions & {fields: Type<MetadataFields>}
> {}

export function metadata(options: MetadataOptions = {}) {
  const fields = type('Fields', {
    title: text('Title', {width: 0.5}),
    description: text('Description', {multiline: true}),
    openGraph: object('Open graph', {
      fields: type('Open graph fields', {
        title: text('Title', {width: 0.5}),
        image: link.image('Image', {width: 0.5}),
        description: text('Description', {multiline: true})
      })
    })
  })
  return new MetadataField(Type.shape(fields), {
    hint: Type.hint(fields),
    label: 'Metadata',
    options: {...options, fields}
  })
}
