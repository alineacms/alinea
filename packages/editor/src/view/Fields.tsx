import {Section} from '@alineacms/core'
import {LazyRecord} from '@alineacms/core/util/LazyRecord'
import {fromModule} from '@alineacms/ui'
import {InputState} from '../InputState'
import css from './Fields.module.scss'
import {Input} from './Input'

const styles = fromModule(css)

export type FieldsProps = {
  state: InputState<any>
  fields: Section.Fields
}

export function Fields({state, fields}: FieldsProps) {
  const list = LazyRecord.iterate(fields)
  return (
    <div className={styles.root()}>
      {list.map(([name, field]) => {
        return <Input key={name} state={state.child(name)} field={field} />
      })}
    </div>
  )
}
