import {Field} from 'alinea/core'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/editor'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundFeed} from 'alinea/ui/icons/IcRoundFeed'
import {ObjectField, object as createObject} from './ObjectField.js'

export * from './ObjectField.js'

export const object = Field.provideView(ObjectInput, createObject)

interface ObjectInputProps<Definition> {
  field: ObjectField<Definition>
}

function ObjectInput<Definition>({field}: ObjectInputProps<Definition>) {
  const {options, value, mutator, label} = useField(field)
  return (
    <InputLabel label={label} {...options} icon={IcRoundFeed}>
      <Sink.Root>
        <Sink.Content>
          <InputForm type={options.fields} />
        </Sink.Content>
      </Sink.Root>
    </InputLabel>
  )
}
