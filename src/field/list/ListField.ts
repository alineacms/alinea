import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ListField} from '#/core/field/ListField.js'
import {createId} from '#/core/Id.js'
import type {InferQueryValue, InferStoredValue} from '#/core/Infer.js'
import type {Schema} from '#/core/Schema.js'
import {ListRow} from '#/core/ListRow.js'
import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {ReactNode} from 'react'

/** Optional settings to configure a list field */
export interface ListOptions<Definitions extends Schema> extends FieldOptions<
  Array<InferStoredValue<Definitions>>
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
  /** The initial value of the field */
  initialValue?: Array<InferStoredValue<Definitions>>
  /** Validate the given value */
  validate?(
    value: Array<InferStoredValue<Definitions> & ListRow>
  ): boolean | string | undefined
}

export interface ColumnsListOptions<Definitions extends Schema> extends Omit<
  ListOptions<Definitions>,
  'initialValue'
> {
  /** Store and display list items in anonymous, resizable rows */
  columns: true
  /** Initial list items, optionally grouped into 12-track rows */
  initialValue?: Array<
    InferStoredValue<Definitions> & Partial<Pick<ListRow, '_layout'>>
  >
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
        return initialValue.map((row, index) => ({
          [ListRow.id]: createId(),
          [ListRow.index]: keys[index],
          ...row
        }))
      }
    },
    view: viewKeys.ListInput
  })
}

export namespace list {
  /** Create a list whose items can be arranged in resizable columns */
  export function columns<Definitions extends Schema>(
    label: string,
    options: WithoutLabel<Omit<ColumnsListOptions<Definitions>, 'columns'>>
  ): ListField<
    InferStoredValue<Definitions> & ListRow,
    InferQueryValue<Definitions> & ListRow,
    ColumnsListOptions<Definitions>
  > {
    return list(label, {
      ...options,
      columns: true
    } as WithoutLabel<ColumnsListOptions<Definitions>>) as ListField<
      InferStoredValue<Definitions> & ListRow,
      InferQueryValue<Definitions> & ListRow,
      ColumnsListOptions<Definitions>
    >
  }
}
