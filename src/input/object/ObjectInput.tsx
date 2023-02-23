import {InputForm, InputLabel, InputState} from 'alinea/editor'
import {Card} from 'alinea/ui'
import {IcRoundFeed} from 'alinea/ui/icons/IcRoundFeed'
import {ObjectField} from './ObjectField'

export type ObjectInputProps<T> = {
  state: InputState<InputState.Record<T>>
  field: ObjectField<T>
}

export function ObjectInput<T>({state, field}: ObjectInputProps<T>) {
  const {width, help} = field.options

  return (
    <InputLabel
      label={field.label}
      help={help}
      width={width}
      icon={IcRoundFeed}
    >
      <Card.Root>
        <Card.Content>
          <InputForm state={state} type={field.options.fields} />
        </Card.Content>
      </Card.Root>
    </InputLabel>
  )
}
