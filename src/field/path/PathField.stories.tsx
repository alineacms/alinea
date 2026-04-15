import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {text} from '#/field.js'
import {path} from '#/field/path.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Fields', {
  fields: {
    title: text('Title'),
    path: path('Path')
  }
})

export function PathField() {
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
  title: 'Fields / Path'
}
