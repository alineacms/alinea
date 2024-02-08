import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {date} from 'alinea/field/date'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Field', {
  date: date('Date', {}),
  focused: date('Date', {autoFocus: true}),
  readOnly: date('Date (read-only)', {
    readOnly: true,
    initialValue: '1900-01-01'
  })
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
