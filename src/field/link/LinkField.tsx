import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import type {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {ListField} from 'alinea/core/field/ListField'
import {UnionField} from 'alinea/core/field/UnionField'
import {ListRow} from 'alinea/core/shape/ListShape'
import {UnionRow} from 'alinea/core/shape/UnionShape'
import {entries, fromEntries} from 'alinea/core/util/Objects'

/** Optional settings to configure a link field */
export interface LinkFieldOptions<Value> extends FieldOptions<Value> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
  /** Display a minimal version */
  inline?: boolean
  max?: number
}

export interface LinkOptions<Value> extends LinkFieldOptions<Value> {
  pickers: Record<string, Picker<any, any>>
}

export class LinkField<Row extends Reference & UnionRow> extends UnionField<
  Row,
  LinkOptions<Row>
> {}

export function createLink<Row extends Reference & UnionRow>(
  label: string,
  options: WithoutLabel<LinkOptions<Row>>
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
    options: {label, ...options},
    async postProcess(value, loader) {
      const type = value[Reference.type]
      const picker = options.pickers[type]
      if (!picker) return
      if (picker.postProcess) await picker.postProcess(value, loader)
    }
  })
}

/** Internal representation of a link field */
export class LinksField<Row extends Reference & ListRow> extends ListField<
  Row,
  LinkOptions<Array<Row>>
> {}

/** Create a link field configuration */
export function createLinks<Row extends Reference & ListRow>(
  label: string,
  options: WithoutLabel<LinkOptions<Array<ListRow & Row>>>
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
    options: {label, ...options},
    async postProcess(rows, loader) {
      const tasks = []
      for (const row of rows) {
        const type = row[ListRow.type]
        const picker = options.pickers[type]
        if (!picker) return
        if (picker.postProcess) tasks.push(picker.postProcess(row, loader))
      }
      await Promise.all(tasks)
    }
  })
}
