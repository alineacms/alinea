import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {date} from '#/field/date.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Field', {
  fields: {
    date: date('Date', {}),
    focused: date('Date', {autoFocus: true}),
    readOnly: date('Date (read-only)', {
      readOnly: true,
      initialValue: '1900-01-01'
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
