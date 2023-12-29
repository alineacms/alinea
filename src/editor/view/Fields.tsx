import {Field} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {Lift} from 'alinea/ui/Lift'
import {InputState} from '../InputState.js'
import {Input} from './Input.js'

export interface FieldsProps {
  state: InputState<any>
  fields: Record<string, Field>
  border?: boolean
}

export function Fields({state, fields, border = true}: FieldsProps) {
  const inner = entries(fields)
    .filter(([name, field]) => !Field.options(field).hidden)
    .map(([name, field]) => {
      return <Input key={name} state={state.child(name)} field={field} />
    })
  if (inner.length === 0) return null
  return border ? <Lift>{inner}</Lift> : <div>{inner}</div>
}
