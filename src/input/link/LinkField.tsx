import type {Picker} from 'alinea/core'
import {FieldOptions, Hint, Label, Reference} from 'alinea/core'
import {ListField} from 'alinea/core/field/ListField'
import {UnionField} from 'alinea/core/field/UnionField'
import {entries, fromEntries} from 'alinea/core/util/Objects'

/** Optional settings to configure a link field */
export interface LinkFieldOptions extends FieldOptions {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  initialValue?: Reference | Array<Reference>
}

export interface LinkOptions<Row extends Reference> extends LinkFieldOptions {
  pickers: Record<string, Picker<any, any>>
}

export class LinkField<Row extends Reference> extends UnionField<
  Row,
  LinkOptions<Row>
> {}

export function createLink<Row extends Reference>(
  label: Label,
  options: LinkOptions<Row>
): LinkField<Row> {
  const pickers = entries(options.pickers)
  const blocks = fromEntries(
    pickers.map(([type, picker]) => [type, picker.shape])
  )
  const hint =
    pickers.length === 1
      ? pickers[0][1].hint
      : Hint.Union(pickers.map(([, picker]) => picker.hint))
  return new LinkField(blocks, {
    hint,
    label,
    options,
    initialValue: options.initialValue as Row,
    async postProcess(value, loader) {
      const type = value.type
      const picker = options.pickers[type]
      if (!picker) return
      if (picker.postProcess) await picker.postProcess(value, loader)
    }
  })
}

/** Internal representation of a link field */
export class LinksField<Row extends Reference> extends ListField<
  Row,
  LinkOptions<Row> & {max?: number}
> {}

/** Create a link field configuration */
export function createLinks<Row extends Reference>(
  label: Label,
  options: LinkOptions<Row> & {max?: number}
): LinksField<Row> {
  const pickers = entries(options.pickers)
  const blocks = fromEntries(
    pickers.map(([type, picker]) => [type, picker.shape])
  )
  const hint =
    pickers.length === 1
      ? pickers[0][1].hint
      : Hint.Union(pickers.map(([, picker]) => picker.hint))
  return new LinksField(blocks, {
    hint: Hint.Array(hint),
    label,
    options,
    async postProcess(rows, loader) {
      const tasks = []
      for (const row of rows) {
        const type = row.type
        const picker = options.pickers[type]
        if (!picker) return
        if (picker.postProcess) tasks.push(picker.postProcess(row, loader))
      }
      await Promise.all(tasks)
    }
  })
}
