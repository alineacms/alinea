import {Section, Type} from 'alinea/core'
import {InputState} from '../InputState.js'
import {Fields} from './Fields.js'

export type InputFormProps = {
  state: InputState<any>
  type: Type
}

export function InputForm({state, type}: InputFormProps) {
  return (
    <>
      {Type.sections(type).map((section, i) => {
        const View = Section.view(section)
        if (View) return <View state={state} section={section} key={i} />
        return <Fields key={i} fields={Section.fields(section)} state={state} />
      })}
    </>
  )
}
