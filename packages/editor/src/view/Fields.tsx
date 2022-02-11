import {Type} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import {InputState} from '../InputState'
import css from './Fields.module.scss'
import {Input} from './Input'

const styles = fromModule(css)

export type FieldsProps = {
  state: InputState<any>
  type: Type
}

export function Fields({state, type}: FieldsProps) {
  const fields = Array.from(type)
  return (
    <div className={styles.root()}>
      <div className={styles.root.inner()}>
        {fields.map(([name, field]) => {
          return <Input key={name} state={state.child(name)} field={field} />
        })}
      </div>
    </div>
  )
}
