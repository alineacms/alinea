import {Field, Type} from 'alinea/core'
import {InputForm, InputLabel, InputState} from 'alinea/editor'
import {Card} from 'alinea/ui'
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
      <Card.Root>
        <Card.Content>
          <InputForm state={state} type={options.fields} />
        </Card.Content>
      </Card.Root>
    </InputLabel>
  )
}
