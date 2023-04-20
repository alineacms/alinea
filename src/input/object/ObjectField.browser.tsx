import {Field} from 'alinea/core'
import {InputForm, InputLabel, InputState} from 'alinea/editor'
import {Card} from 'alinea/ui'
import {IcRoundFeed} from 'alinea/ui/icons/IcRoundFeed'
import {ObjectField, object as createObject} from './ObjectField.js'

export * from './ObjectField.js'

export const object = Field.provideView(ObjectInput, createObject)

type ObjectInputProps<T> = {
  state: InputState<InputState.Record<T>>
  field: ObjectField<T>
}

function ObjectInput<T>({state, field}: ObjectInputProps<T>) {
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
