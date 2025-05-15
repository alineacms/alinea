import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {createId} from 'alinea/core/Id'
import type {InferQueryValue, InferStoredValue} from 'alinea/core/Infer'
import {Schema} from 'alinea/core/Schema'
import {ListField} from 'alinea/core/field/ListField'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {generateNKeysBetween} from 'alinea/core/util/FractionalIndexing'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'

/** Optional settings to configure a list field */
export interface ListOptions<Definitions extends Schema>
  extends FieldOptions<Array<InferStoredValue<Definitions>>> {
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
  /** The initial value of the field */
  initialValue?: Array<InferStoredValue<Definitions>>
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
  >(options.schema, Schema.shapes(options.schema), {
    options: {
      label,
      ...options,
      get initialValue(): any {
        const initialValue = options.initialValue
        if (!Array.isArray(initialValue)) return []
        const keys = generateNKeysBetween(null, null, initialValue.length)
        return initialValue.map((row, index) => ({
          _id: createId(),
          _index: keys[index],
          ...row
        }))
      }
    },
    view: viewKeys.ListInput
  })
}
