import {type} from 'alinea/core/Type'
import {dashboardDecorator} from 'alinea/dashboard/DashboardStory'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {text} from 'alinea/input/text'
import {VStack} from 'alinea/ui'
import {link} from './view'

export function InputStory() {
  const entryLink = useField(link('Entry link', {}))
  const multipleEntryLink = useField(link.multiple('Multiple entry links', {}))
  const externalLink = useField(link('External link', {type: 'external'}))
  const imageLink = useField(link.image('Image link', {}))
  const fileLink = useField(link.file('File link', {}))
  return (
    <VStack>
      <InputField {...entryLink} />
      <InputField {...multipleEntryLink} />
      <InputField {...externalLink} />
      <InputField {...imageLink} />
      <InputField {...fileLink} />
    </VStack>
  )
}

export function WithExtraFields() {
  const entryLink = useField(
    link.multiple('Entry link', {
      fields: type('Fields', {
        field1: text('Field 1')
      })
    })
  )
  return <InputField {...entryLink} />
}

export default {
  title: 'Fields / Link',
  decorators: dashboardDecorator({fullWidth: true})
}
