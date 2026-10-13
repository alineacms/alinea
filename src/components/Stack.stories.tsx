import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {Stack} from './Stack.js'
import {TextField} from './TextField.js'

export function Example() {
  return (
    <Stack gap={16} style={{maxWidth: 360}}>
      <Stack direction="row" align="center" justify="between">
        <strong>About</strong>
        <Badge>Draft</Badge>
      </Stack>
      <TextField label="Title" defaultValue="About us" />
      <TextField label="Path" defaultValue="/about" />
      <Stack direction="row" gap={8} justify="end" wrap>
        <Button variant="outline">Cancel</Button>
        <Button color="primary">Save</Button>
      </Stack>
    </Stack>
  )
}

export default {
  title: 'Pure components / Stack'
}
