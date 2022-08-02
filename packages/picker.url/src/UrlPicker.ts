import {Reference} from '@alinea/core/Reference'
import {Picker} from '@alinea/editor/Picker'

export interface UrlReference extends Reference {
  type: 'url'
  url: string
  description: string
  target: string
}

export function createUrlPicker(): Picker<UrlReference> {
  return {
    type: 'url',
    label: 'Website link',
    handlesMultiple: false,
    options: {}
  }
}
