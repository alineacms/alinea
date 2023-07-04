import {type} from 'alinea/core/Type'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {link} from 'alinea/input/link/LinkConstructors'
import {text} from 'alinea/input/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function InputStory() {
  const entryLink = useField(link.entry('Entry link', {}))
  const multipleEntryLink = useField(
    link.entry.multiple('Multiple entry links', {})
  )
  const externalLink = useField(link.url('External link'))
  const imageLink = useField(link.image('Image link', {}))
  const fileLink = useField(link.file('File link', {}))
  return (
    <UIStory>
      <VStack>
        <InputField {...entryLink} />
        <InputField {...multipleEntryLink} />
        <InputField {...externalLink} />
        <InputField {...imageLink} />
        <InputField {...fileLink} />
      </VStack>
    </UIStory>
  )
}

export function WithExtraFields() {
  const entryLink = useField(
    link.entry.multiple('Entry link', {
      fields: type('Fields', {
        field1: text('Field 1')
      })
    })
  )
  return <InputField {...entryLink} />
}

export default {
  title: 'Fields / Link'
}
