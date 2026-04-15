import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {entry, file, image, link, url} from '#/field/link.js'
import {text} from '#/field/text.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Field', {
  fields: {
    multiple: link.multiple('Multiple', {}),
    entry: entry('Entry link', {}),
    multipleEntries: entry.multiple('Multiple entry links', {}),
    external: url('External link'),
    image: image('Image link'),
    file: file('File link', {}),
    withFields: entry.multiple('With fields', {
      fields: {
        field1: text('Field 1')
      }
    })
  }
})

export function LinkField() {
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
  title: 'Fields / Link'
}
