import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {TextOptions} from '#/field/text/TextField.js'
import {isRecord} from '../util/Objects.js'

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

export function mediaAltText(value: MediaAltValue, locale?: string): string {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return ''
  if (locale && typeof value[locale] === 'string') return value[locale]
  return Object.values(value).find(value => typeof value === 'string') ?? ''
}

export function mediaAltLocalise(
  value: MediaAltValue,
  locales: ReadonlyArray<string>,
  locale: string,
  next: string
): Record<string, string> {
  // A plain alt text is the alt text of every locale
  const current =
    typeof value === 'string'
      ? Object.fromEntries(locales.map(locale => [locale, value]))
      : isRecord(value)
        ? Object.fromEntries(
            Object.entries(value).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
          )
        : {}
  return {...current, [locale]: next}
}
