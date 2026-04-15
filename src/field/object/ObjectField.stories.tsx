import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {object} from '#/field/object.js'
import {text} from '#/field/text/TextField.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Fields', {
  fields: {
    path: object('Object', {
      fields: {
        field1: text('Field 1'),
        field2: text('Field 2')
      }
    })
  }
})

export function ObjectField() {
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
  title: 'Fields / Object'
}
