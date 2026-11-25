import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {getWorkspace} from '#/core/Internal.js'
import {Root} from '#/core/Root.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {formInputs} from '#/field/form/FormAnswers.js'
import {
  type FormInputData,
  formDefinition
} from '#/field/form/FormDefinition.js'
import {FormField} from '#/field/form/FormField.js'
import type {Input} from '#/field/form/FormInput.js'
import {fillForm, fillMails} from '#/field/form/FormShare.js'

/** Where a form is asked for: its entry, and its field when it has several */
export interface FormLocation {
  entryId: string
  locale?: string | null
  field?: string
}

interface FormVersion {
  type: string
  locale: string | null
  workspace: string
  root: string
  data: Record<string, unknown>
}

/** The published form of an entry */
export async function loadForm(
  config: Config,
  graph: Graph,
  {entryId, locale, field: fieldKey}: FormLocation
) {
  const versions = await graph.find({
    id: entryId,
    status: 'published',
    select: {
      type: Entry.type,
      locale: Entry.locale,
      workspace: Entry.workspace,
      root: Entry.root,
      data: Entry.data
    }
  })
  const entry = locale
    ? versions.find(
        version => version.locale?.toLowerCase() === locale.toLowerCase()
      )
    : defaultVersion(config, versions)
  if (!entry) throw new HttpError(404, 'Form not found')
  const type = config.schema[entry.type]
  const fields = type ? entries(Type.fields(type)) : []
  const [key, field] =
    fields.find(
      ([key, field]) =>
        field instanceof FormField &&
        (fieldKey === undefined || key === fieldKey)
    ) ?? []
  if (!key || !(field instanceof FormField))
    throw new HttpError(400, 'The entry has no form')
  const options = Field.options(field)
  const data = options.shared
    ? withFallbacks(config, versions, entry, key, options.inputs)
    : entry.data
  const rows = data[key]
  const inputs = formInputs(formDefinition(options.inputs, rows))
  return {entry, type, data, key, field, rows, inputs}
}

/**
 * The data of a shared form with the texts its language has not translated
 * yet taken from the other languages, so visitors, errors, submissions and
 * mails see the same texts
 */
function withFallbacks(
  config: Config,
  versions: Array<FormVersion>,
  entry: FormVersion,
  key: string,
  inputs: Record<string, Input>
): Record<string, unknown> {
  const {data} = entry
  if (!entry.locale) return data
  const root = rootOf(config, entry)
  const others = Root.fallbackOrder(
    root && Root.data(root).i18n,
    entry.locale,
    versions
  ).map(version => version.data as Record<string, unknown>)
  return {
    ...data,
    [key]: fillForm(
      inputs,
      data[key],
      others.map(other => other[key])
    ),
    ...('mails' in data && {
      mails: fillMails(
        data.mails,
        others.map(other => other.mails)
      )
    })
  }
}

function rootOf(config: Config, entry: FormVersion): Root | undefined {
  const workspace = config.workspaces[entry.workspace]
  return workspace && getWorkspace(workspace).roots[entry.root]
}

/**
 * The version a site that does not say which language it shows gets: that
 * of the default locale of the root
 */
function defaultVersion<Version extends FormVersion>(
  config: Config,
  versions: Array<Version>
): Version | undefined {
  const [first] = versions
  const root = first && rootOf(config, first)
  const locale = root && Root.defaultLocale(root)
  return versions.find(version => version.locale === locale) ?? first
}

/** Whether entries of a type hold a form */
export function hasForm(type: Type | undefined): boolean {
  if (!type) return false
  return entries(Type.fields(type)).some(
    ([, field]) => field instanceof FormField
  )
}

/** The file inputs of a form, they are sent as tokens of their uploads */
export function fileInputs(inputs: Array<FormInputData>): Array<FormInputData> {
  return inputs.filter(input => input.attributes.type === 'file')
}
