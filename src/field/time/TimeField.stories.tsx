import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {time} from 'alinea/field/time'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Field', {
  time: time('Time', {}),
  focused: time('Date', {autoFocus: true}),
  readOnly: time('Date (read-only)', {
    readOnly: true,
    initialValue: '04:20'
  })
})

export function TimeField() {
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
  title: 'Fields / Time'
}
