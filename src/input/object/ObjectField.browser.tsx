import {Field} from 'alinea/core'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldError, useFieldOptions} from 'alinea/dashboard/editor/UseField'
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
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <InputLabel {...options} error={error} icon={IcRoundFeed}>
      <Sink.Root>
        <Sink.Content>
          <FormRow
            field={field}
            type={options.fields}
            readOnly={options.readOnly}
          >
            <InputForm type={options.fields} />
          </FormRow>
        </Sink.Content>
      </Sink.Root>
    </InputLabel>
  )
}
