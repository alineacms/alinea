import {Section, Type} from 'alinea/core'
import {VStack} from 'alinea/ui/Stack'
import {InputState} from '../InputState.js'
import {Fields} from './Fields.js'

export interface InputFormProps {
  state: InputState<any>
  type: Type
  border?: boolean
}

export function InputForm({state, type, border}: InputFormProps) {
  return (
    <VStack gap={20}>
      {Type.sections(type).map((section, i) => {
        const View = Section.view(section)
        if (View) return <View state={state} section={section} key={i} />
        return (
          <div key={i}>
            <Fields
              fields={Section.fields(section)}
              state={state}
              border={border}
            />
          </div>
        )
      })}
    </VStack>
  )
}
