import type {ListField} from '#/core/field/ListField.js'
import type {InferQueryValue, InferStoredValue} from '#/core/Infer.js'
import type {ListRow} from '#/core/ListRow.js'
import {type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import {type ListOptions, list} from '#/field/list.js'
import {path} from '#/field/path.js'
import {tab} from '#/field/tabs.js'
import {text} from '#/field/text.js'

export interface FormChoice {
  /** The id of the option row, which conditions point at */
  id: string
  label: string
  /** Sent by the browser and stored in submissions */
  value: string
}

const Option = type('Option', {
  fields: {
    label: text('Label')
  },
  tabs: {
    option: tab('Option', {
      fields: {
        value: path('Value', {
          from: 'label',
          help: 'Sent and stored for this option, follows the label until you change it'
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
  return list(label, {
    schema: {option: Option},
    compact: true,
    min: 1,
    initialValue: [{_type: 'option', label: 'Option 1'}]
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
