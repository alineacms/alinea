import {Field} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {fromModule} from 'alinea/ui'
import {InputState} from '../InputState.js'
import css from './Fields.module.scss'
import {Input} from './Input.js'

const styles = fromModule(css)

export interface FieldsProps {
  state: InputState<any>
  fields: Record<string, Field>
  border?: boolean
}

export function Fields({state, fields, border = true}: FieldsProps) {
  const list = entries(fields).filter(
    ([key, field]) => !Field.options(field).hidden
  )
  return (
    <div className={styles.root({border})}>
      {list.map(([name, field]) => {
        return <Input key={name} state={state.child(name)} field={field} />
      })}
    </div>
  )
}
