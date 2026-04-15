import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {code} from '#/field/code.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Field', {
  fields: {
    code: code('Code'),
    disabled: code('Code (read-only)', {
      readOnly: true,
      initialValue: `console.info('Hello world!')`
    })
  }
})

export function CodeField() {
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
  title: 'Fields / Code'
}
