import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldError, useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {Sink} from 'alinea/ui/Sink'
import {IcRoundFeed} from 'alinea/ui/icons/IcRoundFeed'
import type {ObjectField} from './ObjectField.js'

export interface ObjectInputProps<Definition> {
  field: ObjectField<Definition>
}

export function ObjectInput<Definition>({field}: ObjectInputProps<Definition>) {
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
