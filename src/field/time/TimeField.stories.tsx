import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {time} from '#/field/time.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Field', {
  fields: {
    time: time('Time', {}),
    focused: time('Date', {autoFocus: true}),
    readOnly: time('Date (read-only)', {
      readOnly: true,
      initialValue: '04:20'
    })
  }
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
