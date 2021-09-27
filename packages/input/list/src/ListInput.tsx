import {inputPath, InputPath} from '@alinea/core'
import {LazyRecord} from '@alinea/core/util/LazyRecord'
import {Fields, Label, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui/styler'
import type {Array as YArray} from 'yjs'
import {ListField, ListRow} from './ListField'
import css from './ListInput.module.scss'

const styles = fromModule(css)

type ListInputRow<T> = ListInputProps<T> & {
  row: ListRow<T>
}

function ListInputRow<T>({row, field, path}: ListInputRow<T>) {
  const channel = LazyRecord.get(field.options.of, row.get('type'))
  if (!channel) return null
  return (
    <div>
      <Fields channel={channel} path={path} />
    </div>
  )
}

export type ListInputProps<T> = {
  path: InputPath<YArray<ListRow<T>>>
  field: ListField<T>
}

export function ListInput<T>({path, field}: ListInputProps<T>) {
  const [rows] = useInput(path)
  const {help} = field.options
  return (
    <Label label={field.label} help={help}>
      {rows.map((row: ListRow<T>, i) => {
        return (
          <ListInputRow
            key={row.get('id') || i}
            row={row}
            field={field}
            path={inputPath(path.concat(i))}
          />
        )
      })}
    </Label>
  )
}
