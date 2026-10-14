'use client'

import {Badge, Button, Stack, TextField} from 'alinea/components'

export function StackExample() {
  return (
    <Stack gap={16} style={{width: 320}}>
      <Stack direction="row" align="center" justify="between">
        <strong>About us</strong>
        <Badge status="draft">Draft</Badge>
      </Stack>
      <TextField label="Title" defaultValue="About us" />
      <TextField label="Path" defaultValue="about" />
      <Stack direction="row" gap={8} justify="end" wrap>
        <Button variant="outline">Cancel</Button>
        <Button color="primary">Save</Button>
      </Stack>
    </Stack>
  )
}
