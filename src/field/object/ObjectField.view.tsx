import {FormRow} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {useFieldError, useFieldOptions} from '#/dashboard/editor/UseField.js'
import {InputLabel} from '#/dashboard/view/InputLabel.js'
import {Sink} from '#/ui/Sink.js'
import {IcRoundFeed} from '#/ui/icons/IcRoundFeed.js'
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
