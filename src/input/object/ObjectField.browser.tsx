import {Field} from 'alinea/core'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldLabel, useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundFeed} from 'alinea/ui/icons/IcRoundFeed'
import {ObjectField, object as createObject} from './ObjectField.js'

export * from './ObjectField.js'

export const object = Field.provideView(ObjectInput, createObject)

interface ObjectInputProps<Definition> {
  field: ObjectField<Definition>
}

function ObjectInput<Definition>({field}: ObjectInputProps<Definition>) {
  const label = useFieldLabel(field)
  const options = useFieldOptions(field)
  return (
    <InputLabel label={label} {...options} icon={IcRoundFeed}>
      <Sink.Root>
        <Sink.Content>
          <FormRow field={field} type={options.fields}>
            <InputForm type={options.fields} />
          </FormRow>
        </Sink.Content>
      </Sink.Root>
    </InputLabel>
  )
}
