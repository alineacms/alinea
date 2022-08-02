import {Reference} from '@alinea/core/Reference'
import {Picker} from '@alinea/editor/Picker'

export interface ExternalReference extends Reference {
  type: 'external'
  url: string
  description: string
  blank: boolean
}

export function createExternalLink(): Picker {
  return {
    type: 'external',
    label: 'External link'
  }
}
