import {TypeConfig} from 'alinea/core'
import {InputState} from '../InputState.js'
import {Fields} from './Fields.js'

export type InputFormProps = {
  state: InputState<any>
  type: TypeConfig<any, any>
}

export function InputForm({state, type}: InputFormProps) {
  return (
    <>
      {type.sections.map((section, i) => {
        if (section.view) return <section.view state={state} key={i} />
        if (!section.fields) return null
        return <Fields key={i} fields={section.fields} state={state} />
      })}
    </>
  )
}
