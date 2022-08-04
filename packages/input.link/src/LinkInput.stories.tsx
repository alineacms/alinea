import {DashboardStory} from '@alinea/dashboard/DashboardStory'
import {useField} from '@alinea/editor'
import {VStack} from '@alinea/ui'
import {link} from './view'

function InputStory() {
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

export function Example() {
  return (
    <DashboardStory fullWidth>
      <InputStory />
    </DashboardStory>
  )
}
