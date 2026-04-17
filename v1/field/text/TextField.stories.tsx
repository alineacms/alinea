import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {text} from '#/field/text.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Fields', {
  fields: {
    text: text('Text', {initialValue: 'Hello world'}),
    focused: text('Text (autofocus)', {autoFocus: true}),
    readOnly: text('Text (read-only)', {
      readOnly: true,
      initialValue: 'Hello world'
    })
  }
})

export function TextField() {
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
  title: 'Fields / Text'
}
