import {Field, Type} from 'alinea/core'
import {InputForm, InputLabel, InputState} from 'alinea/editor'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundFeed} from 'alinea/ui/icons/IcRoundFeed'
import {ObjectField, object as createObject} from './ObjectField.js'

export * from './ObjectField.js'

export const object = Field.provideView(ObjectInput, createObject)

type ObjectInputProps<Definition> = {
  state: InputState<InputState.Record<Type.Infer<Definition>>>
  field: ObjectField<Definition>
}

function ObjectInput<Definition>({state, field}: ObjectInputProps<Definition>) {
  const {label, options} = field[Field.Data]
  return (
    <InputLabel label={label} {...options} icon={IcRoundFeed}>
      <Sink.Root>
        <Sink.Content>
          <InputForm state={state} type={options.fields} />
        </Sink.Content>
      </Sink.Root>
    </InputLabel>
  )
}
