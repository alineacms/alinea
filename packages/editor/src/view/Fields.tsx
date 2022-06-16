import {Section} from '@alinea/core'
import {LazyRecord} from '@alinea/core/util/LazyRecord'
import {fromModule} from '@alinea/ui'
import {InputState} from '../InputState'
import css from './Fields.module.scss'
import {Input} from './Input'

const styles = fromModule(css)

export type FieldsProps = {
  state: InputState<any>
  fields: Section.Fields
}

export function Fields({state, fields}: FieldsProps) {
  const list = LazyRecord.iterate(fields).filter(
    ([key, field]) => !field.hidden
  )
  return (
    <div className={styles.root()}>
      {list.map(([name, field]) => {
        return <Input key={name} state={state.child(name)} field={field} />
      })}
    </div>
  )
}
