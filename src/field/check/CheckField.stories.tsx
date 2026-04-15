import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {check} from '#/field/check.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Fields', {
  fields: {
    normal: check('Check', {inline: true}),
    focused: check('Check (autofocus)', {inline: true, autoFocus: true}),
    checked: check('Check (checked by default)', {
      inline: true,
      initialValue: true
    }),
    readOnly: check('Check (read-only)', {inline: true, readOnly: true})
  }
})

export function CheckField() {
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
  title: 'Fields / Check'
}
