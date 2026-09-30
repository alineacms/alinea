import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import type {
  InferInitialValue,
  InferQueryValue,
  InferStoredValue
} from '#/core/Infer.js'
import type {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {ListRow} from '#/core/ListRow.js'
import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {ReactNode} from 'react'

/** Optional settings to configure a list field */
export interface ListOptions<Definitions extends Schema> extends Omit<
  FieldOptions<Array<InferStoredValue<Definitions>>>,
  'initialValue'
> {
  /** Allow these types of blocks to be created */
  schema: Definitions
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /** Hide this list field */
  hidden?: boolean
  /** Mark the field as invalid while it has fewer items */
  min?: number
  /** Hide the create actions once the list has this many items and mark
   * the field as invalid while it has more */
  max?: number
  /** The initial value of the field, rows can leave out fields to use their
   * default and leave single links empty */
  initialValue?: Array<InferInitialValue<Definitions>>
  /** Validate the given value */
  validate?(
    value: Array<InferStoredValue<Definitions> & ListRow>
  ): boolean | string | undefined
}

/** Create a list field configuration */
export function list<Definitions extends Schema>(
  label: string,
  options: WithoutLabel<ListOptions<Definitions>>
): ListField<
  InferStoredValue<Definitions> & ListRow,
  InferQueryValue<Definitions> & ListRow,
  ListOptions<Definitions>
> {
  return new ListField<
    InferStoredValue<Definitions> & ListRow,
    InferQueryValue<Definitions> & ListRow,
    ListOptions<Definitions>
  >(options.schema, {
    options: {
      label,
      ...options,
      get initialValue(): any {
        const initialValue = options.initialValue
        if (!Array.isArray(initialValue)) return []
        const keys = generateNKeysBetween(null, null, initialValue.length)
        return initialValue.map((row, index) => {
          const value: Record<string, unknown> = {
            [ListRow.id]: createId(),
            [ListRow.index]: keys[index],
            ...row
          }
          // Fill the fields left out, so an empty link is stored as null
          const type = options.schema[value[ListRow.type] as string]
          return type ? Type.withInitialValue(type, value) : value
        })
      }
    },
    view: viewKeys.ListInput
  })
}
