import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {entry, file, image, link, url} from 'alinea/field/link'
import {text} from 'alinea/field/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

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
