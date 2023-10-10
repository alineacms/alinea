import {Field, Meta, Type, type} from 'alinea/core'
import {link} from 'alinea/input/link'
import {tab, tabs} from 'alinea/input/tabs'
import {TextField, text} from 'alinea/input/text'
import {IcBaselineWifiTethering} from 'alinea/ui/icons/IcBaselineWifiTethering'
import IcRoundSearch from 'alinea/ui/icons/IcRoundSearch'
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
  image: LinkField<ImageReference>
  'search:title': TextField
  'search:description': TextField
  'og:title': TextField
  'og:description': TextField
}

export class MetadataField extends Field.Record<
  Type.Infer<MetadataFields>,
  MetadataOptions & {fields: Type<MetadataFields>}
> {}

export function metadata(options: MetadataOptions = {}) {
  const fields = type('Fields', {
    title: text('Title', {width: 0.5}),
    description: text('Description', {multiline: true}),
    image: link.image('Image'),
    ...tabs(
      tab('Search engines', {
        'search:title': text('Title'),
        'search:description': text('Description', {multiline: true}),
        [Meta]: {
          icon: IcRoundSearch
        }
      }),

      tab('Social media', {
        'og:title': text('Title'),
        'og:description': text('Description', {multiline: true}),
        [Meta]: {
          icon: IcBaselineWifiTethering
        }
      })
    )
  })
  return new MetadataField(Type.shape(fields), {
    hint: Type.hint(fields),
    label: 'Metadata',
    options: {...options, fields}
  })
}
