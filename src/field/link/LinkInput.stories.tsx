import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {link} from 'alinea/field/link/LinkConstructors'
import {text} from 'alinea/field/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Field', {
  multiple: link.multiple('Multiple', {}),
  entry: link.entry('Entry link', {}),
  multipleEntries: link.entry.multiple('Multiple entry links', {}),
  external: link.url('External link'),
  image: link.image('Image link'),
  file: link.file('File link', {}),
  withFields: link.entry.multiple('With fields', {
    fields: type('Fields', {
      field1: text('Field 1')
    })
  })
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
