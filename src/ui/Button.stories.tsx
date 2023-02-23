import {Button} from './Button'
import {HStack} from './Stack'
import {uiDecorator} from './UIStory'

export function Buttons() {
  return (
    <HStack gap={16}>
      <Button outline>Cancel</Button>
      <Button>Confirm</Button>
    </HStack>
  )
}

export default {
  title: 'UI',
  decorators: uiDecorator()
}
