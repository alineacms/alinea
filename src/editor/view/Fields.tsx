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
  const inner = entries(fields).map(([name, field]) => {
    const isHidden = Field.options(field).hidden
    if (isHidden) return null
    return <Input key={name} state={state.child(name)} field={field} />
  })
  return border ? <Lift>{inner}</Lift> : <div>{inner}</div>
}
