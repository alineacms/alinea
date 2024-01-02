import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {check} from 'alinea/input/check'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Fields', {
  normal: check('Check', {inline: true}),
  focused: check('Check (autofocus)', {inline: true, autoFocus: true}),
  checked: check('Check (checked by default)', {
    inline: true,
    initialValue: true
  }),
  readOnly: check('Check (read-only)', {inline: true, readOnly: true})
})

export function CheckField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} type={fields} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Check'
}
