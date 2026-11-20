import type {Config} from '#/core/Config.js'
import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {TextOptions} from '#/field/text/TextField.js'
import {selectLocalisedValue} from '#/field/localiser/Localiser.js'
import {Root} from '../Root.js'
import {isRecord, keys} from '../util/Objects.js'

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

export interface MediaAltLocation {
  workspace: unknown
  root: unknown
}

/** The alt text a site renders for a linked file, using its root's fallbacks */
export function linkedMediaAlt(
  config: Config,
  location: MediaAltLocation,
  value: unknown,
  locale: string | null
): string {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return ''
  const i18n = rootI18n(config, location)
  return selectLocalisedValue({
    value: value as Record<string, string>,
    locale,
    locales: i18n?.locales ?? keys(value),
    fallback: i18n?.fallback,
    defaultValue: ''
  })
}

function rootI18n(config: Config, {workspace, root}: MediaAltLocation) {
  if (typeof workspace !== 'string' || typeof root !== 'string') return
  const rootConfig = config.workspaces[workspace]?.[root]
  if (!rootConfig) return
  const data = Root.data(rootConfig)
  return Root.fieldI18n(data) ?? data.i18n
}
