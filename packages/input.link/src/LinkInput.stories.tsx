import {type} from '@alinea/core/Type'
import {DashboardStory} from '@alinea/dashboard/DashboardStory'
import {useField} from '@alinea/editor'
import {text} from '@alinea/input.text'
import {VStack} from '@alinea/ui'
import {FunctionComponent} from 'react'
import {link} from './view'

export function InputStory() {
  const [EntryLink] = useField(link('Entry link', {}))
  const [MultipleEntryLink] = useField(
    link.multiple('Multiple entry links', {})
  )
  const [ExternalLink] = useField(link('External link', {}))
  const [ImageLink] = useField(link.image('Image link', {}))
  const [FileLink] = useField(link.file('File link', {}))
  return (
    <VStack>
      <EntryLink />
      <MultipleEntryLink />
      <ExternalLink />
      <ImageLink />
      <FileLink />
    </VStack>
  )
}

export function WithExtraFields() {
  const [EntryLink] = useField(
    link.multiple('Entry link', {
      fields: type('Fields', {
        field1: text('Field 1')
      })
    })
  )
  return <EntryLink />
}

export default {
  decorators: [
    (Story: FunctionComponent) => (
      <DashboardStory fullWidth>
        <Story />
      </DashboardStory>
    )
  ]
}
