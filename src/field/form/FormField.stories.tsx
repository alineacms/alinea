import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'
import {form} from './FormField.js'

const fields = type('Field', {
  fields: {
    date: form('Form', {}),
    focused: form('Form', {}),
    readOnly: form('Form (read-only)', {
      readOnly: true
    })
  }
})

export function DateField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Date'
}
