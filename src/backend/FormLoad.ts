import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {formInputs} from '#/field/form/FormAnswers.js'
import {
  type FormInputData,
  formDefinition
} from '#/field/form/FormDefinition.js'
import {FormField} from '#/field/form/FormField.js'

/** Where a form is asked for: its entry, and its field when it has several */
export interface FormLocation {
  entryId: string
  locale?: string | null
  field?: string
}

/** The published form of an entry */
export async function loadForm(
  config: Config,
  graph: Graph,
  {entryId, locale, field: fieldKey}: FormLocation
) {
  const entry = await graph.first({
    id: entryId,
    ...(locale ? {locale} : {}),
    status: 'published',
    select: {type: Entry.type, locale: Entry.locale, data: Entry.data}
  })
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
  const data = entry.data as Record<string, unknown>
  const rows = data[key]
  const inputs = formInputs(formDefinition(Field.options(field).inputs, rows))
  return {entry, type, data, key, field, rows, inputs}
}

/** The file inputs of a form, they are sent as tokens of their uploads */
export function fileInputs(inputs: Array<FormInputData>): Array<FormInputData> {
  return inputs.filter(input => input.attributes.type === 'file')
}
