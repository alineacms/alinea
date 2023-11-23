import {Button} from './Button.js'
import {HStack} from './Stack.js'
import {uiDecorator} from './UIStory.js'

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
