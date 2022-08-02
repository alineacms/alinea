import {Picker} from '@alinea/editor/Picker'
import {createExternalLink} from './ExternalLink'
import {ExternalLinkPicker} from './ExternalLinkPicker'

export const externalLink = Picker.withView(
  createExternalLink,
  ExternalLinkPicker
)
