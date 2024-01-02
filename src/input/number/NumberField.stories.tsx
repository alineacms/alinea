import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {number} from 'alinea/input/number'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type({
  number: number('Number'),
  readOnly: number('Number (read-only)', {readOnly: true, initialValue: 0})
})

export function NumberField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm type={fields} form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Number'
}
