import type {Reference} from '#/core/Reference.js'

export interface PickerValue {
  link?: Reference
  description?: string
  title?: string
  blank?: boolean
}

export interface PickerOptions extends PickerValue {
  requireDescription?: boolean
  hasLink?: boolean
}

export interface PickTextLinkFunc {
  (options: Partial<PickerOptions>): Promise<PickerValue | undefined>
}
