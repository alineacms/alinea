import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {TextOptions} from '#/field/text/TextField.js'

export type MediaAltValue = string | Record<string, string> | undefined

export interface MediaAltOptions
  extends
    Omit<TextOptions, 'initialValue' | 'validate'>,
    FieldOptions<MediaAltValue> {}

export class MediaAltField extends ScalarField<
  MediaAltValue,
  MediaAltOptions
> {}

export function mediaAlt(
  label: string,
  options: WithoutLabel<MediaAltOptions> = {}
) {
  return new MediaAltField({
    options: {label, ...options},
    view: viewKeys.MediaAltInput
  })
}
