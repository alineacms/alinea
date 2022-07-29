import {DashboardStory} from '@alinea/dashboard/DashboardStory'
import {useField} from '@alinea/editor'
import {VStack} from '@alinea/ui'
import {link} from './view'

function InputStory() {
  const [EntryLink] = useField(link('Entry link', {}))
  const [ExternalLink] = useField(link('External link', {}))
  const [ImageLink] = useField(link.image('Image link', {}))
  return (
    <VStack>
      <EntryLink />
      <ExternalLink />
      <ImageLink />
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
