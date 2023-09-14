import {Field} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {fromModule} from 'alinea/ui'
import {InputState} from '../InputState.js'
import {useInput} from '../hook/UseInput.js'
import css from './Fields.module.scss'
import {Input} from './Input.js'

const styles = fromModule(css)

export interface FieldsProps {
  state: InputState<any>
  fields: Record<string, Field>
  border?: boolean
}

export function Fields({state, fields, border = true}: FieldsProps) {
  useInput(state)
  return (
    <div className={styles.root({border})}>
      {entries(fields).map(([name, field]) => {
        const isHidden = Field.options(field).hidden
        if (isHidden) return null
        return <Input key={name} state={state.child(name)} field={field} />
      })}
    </div>
  )
}
