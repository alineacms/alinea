import {ListField} from '#/core/field/ListField.js'
import {getField} from '#/core/Internal.js'
import type {InferQueryValue, InferStoredValue} from '#/core/Infer.js'
import type {ListRow} from '#/core/ListRow.js'
import {type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {slugify} from '#/core/util/Slugs.js'
import {type ListOptions, list} from '#/field/list.js'
import {path} from '#/field/path.js'
import {tab} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import {languageText} from './FormShare.js'

export interface FormChoice {
  /** The id of the option row, which conditions point at */
  id: string
  label: string
  /** Sent by the browser and stored in submissions */
  value: string
}

const Option = type('Option', {
  fields: {
    label: languageText(text('Label'))
  },
  tabs: {
    option: tab('Option', {
      fields: {
        value: path('Key', {
          from: 'label',
          help:
            'Shared by all languages and stored with each answer, it follows ' +
            'the label until you change it. Answers already sent keep the ' +
            'key they were sent with.'
        })
      }
    })
  }
})

type OptionRows = {option: typeof Option}

/** The choices of a radio, checkboxes or select input, one line each */
export function options(
  label = 'Options'
): ListField<
  InferStoredValue<OptionRows> & ListRow,
  InferQueryValue<OptionRows> & ListRow,
  ListOptions<OptionRows>
> {
  const schema = {option: Option}
  const field = list(label, {
    schema,
    compact: true,
    min: 1,
    initialValue: [{_type: 'option', label: 'Option 1'}]
  })
  // The same list with a view that shows the key of each option
  return new ListField(schema, {
    options: getField(field).options,
    view: viewKeys.FormOptionsInput
  })
}

/** The options as choices, leaving out the empty ones */
export function choices(value: unknown): Array<FormChoice> {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).flatMap(row => {
    const id = row._id
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    // An empty line in the editor is not an option yet
    if (typeof id !== 'string' || !label) return []
    const own = typeof row.value === 'string' && row.value ? row.value : ''
    return [{id, label, value: own || slugify(label)}]
  })
}
