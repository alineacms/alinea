import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {number} from '#/field/number.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Fields', {
  fields: {
    number: number('Number'),
    readOnly: number('Number (read-only)', {readOnly: true, initialValue: 0})
  }
})

export function NumberField() {
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
  title: 'Fields / Number'
}
